// BiRefNet-lite (high-resolution dichotomous segmentation) running in the
// browser via transformers.js. Returns an alpha matte only — colour pixels
// of the character are never touched. Falls back to null when unavailable
// or too slow, so the cut-out never freezes.
import { AutoModel, AutoProcessor, RawImage, env } from "@huggingface/transformers";

const MODEL_ID = "onnx-community/BiRefNet_lite-ONNX";
env.allowLocalModels = false;

type Loaded = { model: any; processor: any; device: string };
let loading: Promise<Loaded | null> | null = null;
let onDl: ((p: number) => void) | null = null;

const withTimeout = <T,>(p: Promise<T>, ms: number, what: string) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`${what} timed out`)), ms))]);

const tryLoad = async (device: "webgpu" | "wasm", dtype: "fp16" | "fp32"): Promise<Loaded> => {
  const files: Record<string, { loaded: number; total: number }> = {};
  const model = await withTimeout(
    AutoModel.from_pretrained(MODEL_ID, {
      device,
      dtype,
      progress_callback: (d: any) => {
        if (d?.status === "progress" && d.file) {
          files[d.file] = { loaded: d.loaded ?? 0, total: d.total ?? 0 };
          const all = Object.values(files);
          const t = all.reduce((s, f) => s + f.total, 0);
          if (t) onDl?.(all.reduce((s, f) => s + f.loaded, 0) / t);
        }
      },
    } as any),
    180_000,
    "Remover download",
  );
  const processor = await AutoProcessor.from_pretrained(MODEL_ID);
  // Probe once: some graphics chips load the model but fail to run it.
  const probe = new RawImage(new Uint8ClampedArray(64 * 64 * 3).fill(128), 64, 64, 3);
  const { pixel_values } = await processor(probe);
  await withTimeout(model({ input_image: pixel_values }), 90_000, "Remover test run");
  return { model, processor, device };
};

export const loadBiRefNet = (onDownload?: (p: number) => void) => {
  if (onDownload) onDl = onDownload;
  if (loading) return loading;
  loading = (async () => {
    const gpu = typeof navigator !== "undefined" && !!(navigator as any).gpu && !!(await (navigator as any).gpu.requestAdapter?.().catch(() => null));
    const opts: ["webgpu" | "wasm", "fp16" | "fp32"][] = gpu ? [["webgpu", "fp16"], ["webgpu", "fp32"]] : [];
    for (const [d, dt] of opts) {
      try {
        const t0 = performance.now();
        const m = await tryLoad(d, dt);
        console.info(`[cutout] BiRefNet loaded on ${d} in ${Math.round(performance.now() - t0)}ms`);
        return m;
      } catch (e) { console.warn(`[cutout] BiRefNet ${d} failed`, e); }
    }
    return null;
  })();
  return loading;
};

/** Disable BiRefNet for this session (used when it proves too slow). */
export const disableBiRefNet = () => { loading = Promise.resolve(null); };

/** Returns a w*h matte (0..255) for the given RGBA frame, or null. */
export async function birefnetMatte(rgba: ImageData, timeoutMs = 20_000): Promise<Uint8ClampedArray | null> {
  const m = await loadBiRefNet();
  if (!m) return null;
  const run = async () => {
    const img = new RawImage(new Uint8ClampedArray(rgba.data), rgba.width, rgba.height, 4).rgb();
    const { pixel_values } = await m.processor(img);
    const out = await m.model({ input_image: pixel_values });
    const logits = (out.output_image ?? Object.values(out)[0]) as any;
    const sig = logits[0].sigmoid().mul(255).to("uint8");
    const mask = await RawImage.fromTensor(sig).resize(rgba.width, rgba.height);
    const d = mask.data as Uint8ClampedArray;
    // Mask may come back with >1 channel; take the first.
    if (d.length === rgba.width * rgba.height) return d;
    const ch = d.length / (rgba.width * rgba.height), o = new Uint8ClampedArray(rgba.width * rgba.height);
    for (let p = 0; p < o.length; p++) o[p] = d[p * ch];
    return o;
  };
  try {
    return await withTimeout(run(), timeoutMs, "Remover frame");
  } catch (e) {
    if (m.device !== "webgpu") throw e;
    // Graphics chip failed: retry once on the normal processor.
    console.warn("[cutout] BiRefNet webgpu run failed, retrying on wasm", e);
    loading = tryLoad("wasm", "fp32").catch(() => null);
    const w = await loading;
    if (!w) throw e;
    return birefnetMatte(rgba, Math.max(timeoutMs, 60_000));
  }
}
