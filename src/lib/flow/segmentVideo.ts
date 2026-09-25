// AI subject cut-out for Flow clips. For every frame the AI finds the
// character (not a colour) and produces an alpha matte. The output is a
// "stacked" VP9 WebM: original colour pixels on top, matte (grey) below.
// Playback recombines them into true transparency in every browser.
// Colour pixels are never altered.
import { segmentForeground, preload } from "@imgly/background-removal";
import { Muxer, ArrayBufferTarget } from "webm-muxer";
import { birefnetMatte, disableBiRefNet, loadBiRefNet } from "./birefnet";
import { openDecodedSource, type FrameSource } from "./frameSource";
import { detectChecker, keyChecker } from "./checkerKey";

export interface SegmentOptions {
  url: string;
  refineMaskUrl?: string | null;
  fps?: number;
  onProgress?: (p: number) => void;
  onStage?: (s: string) => void;
  signal?: AbortSignal;
  edgeStrength?: "soft" | "normal" | "tight";
}

const EDGE = { soft: { th: 6, erode: 0 }, normal: { th: 14, erode: 1 }, tight: { th: 32, erode: 2 } };

const MAX_H = 720;
const cfg = { model: "isnet_fp16" as const, output: { format: "image/png" as const } };

const loadVideo = (url: string) =>
  new Promise<HTMLVideoElement>((res, rej) => {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    const to = window.setTimeout(() => rej(new Error("The video took too long to load. Check your connection and try again.")), 45_000);
    v.onloadeddata = () => { clearTimeout(to); res(v); };
    v.onerror = () => { clearTimeout(to); rej(new Error("This browser could not open the video file. Try Chrome or Edge.")); };
    v.src = url;
  });

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("mask load failed"));
    i.src = url;
  });

// Resolves on "seeked", or immediately when already there (seeked never
// fires for a no-op seek — this used to freeze the cut-out at frame 0).
const seek = (v: HTMLVideoElement, t: number) =>
  new Promise<void>((res) => {
    if (Math.abs(v.currentTime - t) < 1e-4 && v.readyState >= 2) return res();
    let to = 0;
    const done = () => { v.removeEventListener("seeked", done); clearTimeout(to); res(); };
    v.addEventListener("seeked", done);
    to = window.setTimeout(done, 3000);
    v.currentTime = t;
  });

const blobToImage = async (b: Blob) => {
  const bmp = await createImageBitmap(b);
  return bmp;
};

export const supportsCutout = () => typeof (window as any).VideoEncoder === "function";

export async function segmentVideo({ url, refineMaskUrl, fps = 30, onProgress, onStage, signal, edgeStrength = "normal" }: SegmentOptions): Promise<{ blob: Blob; report: CutoutReport }> {
  if (!supportsCutout()) throw new Error("This browser can't encode video. Please use Chrome or Edge to cut out the character.");
  const T0 = performance.now();
  const fast = await tryChecker({ url, refineMaskUrl, onProgress, onStage, signal, edgeStrength, T0 });
  if (fast) return fast;
  onStage?.("Downloading remover…");
  const ok = await loadBiRefNet((p) => onStage?.(`Downloading remover ${Math.round(p * 100)}%`));
  if (!ok) { onStage?.("Loading standard remover…"); await preload(cfg).catch(() => {}); }
  onStage?.("Loading video…");
  // Fast path: decode frames in order with WebCodecs. Fallback: <video> seeks.
  let src: FrameSource | null = null;
  try { src = await openDecodedSource(url, onStage); } catch (e) { console.warn("[cutout] fast reader failed", e); }
  const video = src ? null : await loadVideo(url);
  if (src) fps = src.fps;
  const vw = src ? src.width : video!.videoWidth, vh = src ? src.height : video!.videoHeight;
  const duration = src ? src.total / src.fps : video!.duration;
  console.info(`[cutout] ready in ${Math.round(performance.now() - T0)}ms, model=${ok ? "BiRefNet" : "standard"}, reader=${src ? "fast" : "seek"}, ${vw}x${vh} @${fps}fps, ${duration.toFixed(1)}s`);
  const scale = Math.min(1, MAX_H / vh);
  const w = Math.round((vw * scale) / 2) * 2;
  const h = Math.round((vh * scale) / 2) * 2;

  const frame = new OffscreenCanvas(w, h);
  const fctx = frame.getContext("2d", { willReadFrequently: true })!;
  const out = new OffscreenCanvas(w, h * 2);
  const octx = out.getContext("2d", { willReadFrequently: true })!;

  // Keep/remove brush: white = keep, black = remove, transparent = AI decides.
  let refine: Uint8ClampedArray | null = null;
  if (refineMaskUrl) {
    try {
      const img = await loadImage(refineMaskUrl);
      const c = new OffscreenCanvas(w, h);
      const cx = c.getContext("2d", { willReadFrequently: true })!;
      cx.drawImage(img, 0, 0, w, h);
      refine = cx.getImageData(0, 0, w, h).data;
    } catch { /* ignore */ }
  }

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({ target, video: { codec: "V_VP9", width: w, height: h * 2, frameRate: fps } });
  let encErr: Error | null = null;
  const VE = (window as any).VideoEncoder;
  const encoder = new VE({
    output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
    error: (e: Error) => { encErr = e; },
  });
  encoder.configure({ codec: "vp09.00.10.08", width: w, height: h * 2, bitrate: 14_000_000, framerate: fps });

  const total = src ? src.total : Math.max(1, Math.floor(duration * fps));
  const E = EDGE[edgeStrength] ?? EDGE.normal;
  let useBiRef = !!ok;
  let repaired = 0;
  let slow = 0;
  const samples: { index: number; image: string }[] = [];
  const sampleEvery = Math.max(1, Math.floor(total / 8));

  // The AI runs on every STRIDE-th frame (10 per second); frames in between
  // blend the two nearest AI mattes. This makes long clips ~3x faster while
  // colour pixels still come from every original frame.
  const STRIDE = 3;
  const last = total - 1;
  const cache = new Map<number, Float32Array>();
  let aiMs = 0, aiN = 0;
  const frames = new Map<number, ImageData>();
  let read = 0;
  const grab = async (i: number) => {
    if (!src) {
      await seek(video!, Math.min(duration - 0.001, i / fps));
      fctx.clearRect(0, 0, w, h);
      fctx.drawImage(video!, 0, 0, w, h);
      return fctx.getImageData(0, 0, w, h);
    }
    while (read <= i) {
      if (!(await src.next(fctx, w, h))) break;
      frames.set(read++, fctx.getImageData(0, 0, w, h));
    }
    for (const k of frames.keys()) if (k < i - 2 * STRIDE - 2) frames.delete(k);
    const f = frames.get(i) ?? frames.get(read - 1);
    if (!f) throw new Error("Frame missing");
    return new ImageData(new Uint8ClampedArray(f.data), w, h);
  };
  const aiMatte = async (k: number) => {
    const hit = cache.get(k);
    if (hit) return hit;
    const t0 = performance.now();
    const rgb = await grab(k);
    const alpha = new Float32Array(w * h);
    let md: Uint8ClampedArray | null = null;
    if (useBiRef) {
      try { md = await birefnetMatte(rgb, aiN === 0 ? 90_000 : 20_000); } catch (e) { console.warn("[cutout]", e); md = null; }
      if (!md) { useBiRef = false; disableBiRefNet(); await preload(cfg).catch(() => {}); }
      else if (aiN > 0 && performance.now() - t0 > 8000 && ++slow >= 3) {
        console.warn("[cutout] BiRefNet too slow on this device, switching to standard remover");
        useBiRef = false; disableBiRefNet(); await preload(cfg).catch(() => {});
      }
    }
    if (md) {
      for (let p = 0; p < alpha.length; p++) alpha[p] = md[p];
    } else {
      const png = await frame.convertToBlob({ type: "image/png" });
      const maskBmp = await blobToImage(await segmentForeground(png, cfg));
      octx.clearRect(0, 0, w, h * 2);
      octx.drawImage(maskBmp, 0, 0, w, h);
      maskBmp.close();
      const d = octx.getImageData(0, 0, w, h).data;
      for (let p = 0, q = 0; p < alpha.length; p++, q += 4) alpha[p] = d[q + 3] < 255 ? d[q + 3] : d[q];
    }
    const ms = performance.now() - t0;
    if (aiN > 0) aiMs += ms;
    aiN++;
    if (aiN <= 3 || aiN % 20 === 0) console.info(`[cutout] AI frame ${k} ${Math.round(ms)}ms (${useBiRef ? "BiRefNet" : "standard"})`);
    cache.set(k, alpha);
    for (const key of cache.keys()) if (key < k - 2 * STRIDE) cache.delete(key);
    return alpha;
  };

  const rawFrame = async (i: number) => {
    const k0 = Math.floor(i / STRIDE) * STRIDE, k1 = Math.min(k0 + STRIDE, last);
    const a0 = await aiMatte(k0);
    const a1 = k1 !== k0 && i !== k0 ? await aiMatte(k1) : a0;
    const rgb = await grab(i);
    const alpha = new Float32Array(w * h);
    const f = k1 === k0 ? 0 : (i - k0) / (k1 - k0);
    for (let p = 0; p < alpha.length; p++) alpha[p] = a0[p] * (1 - f) + a1[p] * f;
    if (refine) for (let p = 0, q = 0; p < alpha.length; p++, q += 4) {
      if (refine[q + 3] > 32) alpha[p] = refine[q] > 127 ? 255 : 0;
    }
    const avg = aiN > 1 ? aiMs / (aiN - 1) : 0;
    const left = avg ? Math.ceil(((total - i) / STRIDE) * avg / 60000) : null;
    onStage?.(`Cutting frame ${i + 1} of ${total}${left !== null ? ` · about ${left} min left` : ""}`);
    return { rgb, alpha };
  };

  const iou = (a: Float32Array, b: Float32Array) => {
    let inter = 0, uni = 0;
    for (let p = 0; p < a.length; p += 4) {
      const x = a[p] > 127, y = b[p] > 127;
      if (x && y) inter++;
      if (x || y) uni++;
    }
    return uni ? inter / uni : 1;
  };

  let prev: { rgb: ImageData; alpha: Float32Array } | null = null;
  let cur = await rawFrame(0);
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) { encoder.close(); throw new DOMException("Cancelled", "AbortError"); }
    if (encErr) throw encErr;
    const next = i + 1 < total ? await rawFrame(i + 1) : null;
    const alpha = cur.alpha;

    // Broken-frame repair: if neighbours agree with each other but this
    // frame disagrees with both, rebuild its matte from the neighbours.
    if (prev && next && iou(prev.alpha, next.alpha) > 0.9 && iou(alpha, prev.alpha) < 0.8 && iou(alpha, next.alpha) < 0.8) {
      for (let p = 0; p < alpha.length; p++) alpha[p] = (prev.alpha[p] + next.alpha[p]) / 2;
      repaired++;
    } else if (prev || next) {
      // Bidirectional smoothing against edge flicker.
      for (let p = 0; p < alpha.length; p++) {
        let s = alpha[p] * 2, n = 2;
        if (prev && Math.abs(prev.alpha[p] - alpha[p]) < 60) { s += prev.alpha[p]; n++; }
        if (next && Math.abs(next.alpha[p] - alpha[p]) < 60) { s += next.alpha[p]; n++; }
        alpha[p] = s / n;
      }
    }
    const keepAlpha = Float32Array.from(alpha); // pre-cleanup matte for neighbour checks

    for (let p = 0; p < alpha.length; p++) if (alpha[p] < E.th) alpha[p] = 0;
    const tmp = new Float32Array(alpha.length);
    for (let k = 0; k < E.erode; k++) {
      tmp.set(alpha);
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        alpha[p] = Math.min(tmp[p], tmp[p - 1], tmp[p + 1], tmp[p - w], tmp[p + w]);
      }
    }
    const rgb = cur.rgb;
    decontaminate(rgb.data, alpha, w, h);

    octx.putImageData(rgb, 0, 0);
    const matte = octx.createImageData(w, h);
    const m = matte.data;
    for (let p = 0, q = 0; p < alpha.length; p++, q += 4) {
      const a = Math.round(alpha[p]);
      m[q] = m[q + 1] = m[q + 2] = a;
      m[q + 3] = 255;
    }
    octx.putImageData(matte, 0, h);

    if (i % sampleEvery === 0 && samples.length < 10) samples.push({ index: i, image: composite(rgb, alpha, w, h) });

    const VF = (window as any).VideoFrame;
    const vf = new VF(out, { timestamp: Math.round((i * 1_000_000) / fps), duration: Math.round(1_000_000 / fps) });
    encoder.encode(vf, { keyFrame: i % 60 === 0 });
    vf.close();
    while (encoder.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 5));
    onProgress?.((i + 1) / total);
    prev = { rgb, alpha: keepAlpha };
    if (next) cur = next;
  }
  src?.close();
  await encoder.flush();
  encoder.close();
  muxer.finalize();
  console.info(`[cutout] done ${total} frames in ${Math.round((performance.now() - T0) / 1000)}s, repaired ${repaired}`);
  (window as any).__lastCutout = { total, repaired, samples };
  return {
    blob: new Blob([target.buffer], { type: "video/webm" }),
    report: { total, repaired, model: useBiRef ? "BiRefNet" : "standard", samples, fps },
  };
}

/** Fast path: native alpha or baked-in checkerboard → alpha, one stream pass. */
async function tryChecker(o: { url: string; refineMaskUrl?: string | null; onProgress?: (p: number) => void; onStage?: (s: string) => void; signal?: AbortSignal; edgeStrength: "soft" | "normal" | "tight"; T0: number }): Promise<{ blob: Blob; report: CutoutReport } | null> {
  o.onStage?.("Checking video background…");
  let src: FrameSource | null = null;
  try { src = await openDecodedSource(o.url, o.onStage); } catch (e) { console.warn("[checker] reader failed", e); }
  const video = src ? null : await loadVideo(o.url);
  const fps = src ? src.fps : 30;
  const vw = src ? src.width : video!.videoWidth, vh = src ? src.height : video!.videoHeight;
  const total = src ? src.total : Math.max(1, Math.floor(video!.duration * fps));
  const scale = Math.min(1, MAX_H / vh);
  const w = Math.round((vw * scale) / 2) * 2, h = Math.round((vh * scale) / 2) * 2;
  const frame = new OffscreenCanvas(w, h);
  const fctx = frame.getContext("2d", { willReadFrequently: true })!;
  const grab = async (i: number) => {
    fctx.clearRect(0, 0, w, h);
    if (src) { if (!(await src.next(fctx, w, h))) return null; }
    else { await seek(video!, Math.min(video!.duration - 0.001, i / fps)); fctx.drawImage(video!, 0, 0, w, h); }
    return fctx.getImageData(0, 0, w, h);
  };
  const first = await grab(0);
  if (!first) { src?.close(); return null; }
  let native = false;
  for (let q = 3; q < first.data.length; q += 4 * 97) if (first.data[q] < 250) { native = true; break; }
  const model = native ? null : detectChecker(first);
  if (!native && !model) { src?.close(); console.info("[checker] no checkerboard, using AI remover"); return null; }
  o.onStage?.(native ? "Video already transparent: keeping it" : "Checkerboard detected: fast mode");

  let refine: Uint8ClampedArray | null = null;
  if (o.refineMaskUrl) {
    try { const img = await loadImage(o.refineMaskUrl); const c = new OffscreenCanvas(w, h); const cx = c.getContext("2d", { willReadFrequently: true })!; cx.drawImage(img, 0, 0, w, h); refine = cx.getImageData(0, 0, w, h).data; } catch { /* ignore */ }
  }
  const out = new OffscreenCanvas(w, h * 2);
  const octx = out.getContext("2d", { willReadFrequently: true })!;
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({ target, video: { codec: "V_VP9", width: w, height: h * 2, frameRate: fps } });
  let encErr: Error | null = null;
  const VE = (window as any).VideoEncoder;
  const encoder = new VE({ output: (c: any, m: any) => muxer.addVideoChunk(c, m), error: (e: Error) => { encErr = e; } });
  encoder.configure({ codec: "vp09.00.10.08", width: w, height: h * 2, bitrate: 14_000_000, framerate: fps });
  const samples: { index: number; image: string }[] = [];
  const sampleEvery = Math.max(1, Math.floor(total / 8));
  let prev: Float32Array | null = null;
  let img: ImageData | null = first;
  let done = 0;
  const tStart = performance.now();
  for (let i = 0; i < total && img; i++) {
    if (o.signal?.aborted) { encoder.close(); src?.close(); throw new DOMException("Cancelled", "AbortError"); }
    if (encErr) throw encErr;
    const alpha = new Float32Array(w * h);
    if (native) for (let p = 0; p < alpha.length; p++) alpha[p] = img.data[p * 4 + 3];
    else keyChecker(model!, img, alpha, o.edgeStrength, prev);
    if (refine) for (let p = 0, q = 0; p < alpha.length; p++, q += 4) if (refine[q + 3] > 32) alpha[p] = refine[q] > 127 ? 255 : 0;
    for (let q = 3; q < img.data.length; q += 4) img.data[q] = 255;
    octx.putImageData(img, 0, 0);
    const matte = octx.createImageData(w, h), md = matte.data;
    for (let p = 0, q = 0; p < alpha.length; p++, q += 4) { const a = Math.round(alpha[p]); md[q] = md[q + 1] = md[q + 2] = a; md[q + 3] = 255; }
    octx.putImageData(matte, 0, h);
    if (i % sampleEvery === 0 && samples.length < 10) samples.push({ index: i, image: composite(img, alpha, w, h) });
    const VF = (window as any).VideoFrame;
    const vf = new VF(out, { timestamp: Math.round((i * 1_000_000) / fps), duration: Math.round(1_000_000 / fps) });
    encoder.encode(vf, { keyFrame: i % 60 === 0 });
    vf.close();
    while (encoder.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 5));
    prev = alpha; done = i + 1;
    o.onProgress?.(done / total);
    if (i % 10 === 0) {
      const per = (performance.now() - tStart) / done;
      o.onStage?.(`Checkerboard mode · frame ${done} of ${total} · about ${Math.ceil(((total - done) * per) / 60000)} min left`);
    }
    if (i % 300 === 0) console.info(`[checker] frame ${i}/${total} ${Math.round((performance.now() - tStart) / done)}ms/frame`);
    img = i + 1 < total ? await grab(i + 1) : null;
  }
  src?.close();
  await encoder.flush(); encoder.close(); muxer.finalize();
  console.info(`[checker] done ${done} frames in ${Math.round((performance.now() - o.T0) / 1000)}s`);
  (window as any).__lastCutout = { total: done, repaired: 0, samples };
  return { blob: new Blob([target.buffer], { type: "video/webm" }), report: { total: done, repaired: 0, model: native ? "original transparency" : "checkerboard", samples, fps } };
}

export interface CutoutReport {
  total: number;
  repaired: number;
  model: string;
  fps: number;
  samples: { index: number; image: string }[];
}

/** Small JPEG of the frame on a checker / black / white split backdrop. */
function composite(rgb: ImageData, alpha: Float32Array, w: number, h: number) {
  const s = Math.min(1, 384 / w), cw = Math.round(w * s), ch = Math.round(h * s);
  const c = document.createElement("canvas"); c.width = cw; c.height = ch;
  const x = c.getContext("2d")!;
  const img = new ImageData(w, h);
  for (let p = 0, q = 0; p < alpha.length; p++, q += 4) {
    img.data[q] = rgb.data[q]; img.data[q + 1] = rgb.data[q + 1]; img.data[q + 2] = rgb.data[q + 2]; img.data[q + 3] = alpha[p];
  }
  const t = document.createElement("canvas"); t.width = w; t.height = h;
  t.getContext("2d")!.putImageData(img, 0, 0);
  for (let yy = 0; yy < ch; yy += 12) for (let xx = 0; xx < cw / 3; xx += 12) {
    x.fillStyle = ((xx + yy) / 12) % 2 ? "#bbb" : "#eee"; x.fillRect(xx, yy, 12, 12);
  }
  x.fillStyle = "#000"; x.fillRect(cw / 3, 0, cw / 3, ch);
  x.fillStyle = "#fff"; x.fillRect((2 * cw) / 3, 0, cw / 3, ch);
  x.drawImage(t, 0, 0, cw, ch);
  return c.toDataURL("image/jpeg", 0.7);
}

/** Grab a single frame of the original clip (for the refinement brush). */
export async function grabFrame(url: string, t: number) {
  const v = await loadVideo(url);
  await seek(v, Math.min(Math.max(0, t), v.duration - 0.01));
  const c = document.createElement("canvas");
  c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext("2d")!.drawImage(v, 0, 0);
  return c.toDataURL("image/jpeg", 0.9);
}

/** Estimate local background (coarse grid, weighted by 1-alpha) and solve
 *  F = (C - (1-a)B)/a only for 0<a<255 pixels. Solid Fairy pixels untouched. */
function decontaminate(d: Uint8ClampedArray, alpha: Float32Array, w: number, h: number) {
  const S = 16, gw = Math.ceil(w / S), gh = Math.ceil(h / S);
  const acc = new Float32Array(gw * gh * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x, b = 1 - alpha[p] / 255;
    if (b < 0.9) continue;
    const g = (((y / S) | 0) * gw + ((x / S) | 0)) * 4, q = p * 4;
    acc[g] += d[q]; acc[g + 1] += d[q + 1]; acc[g + 2] += d[q + 2]; acc[g + 3] += 1;
  }
  // Fill empty cells from neighbours (few passes).
  for (let pass = 0; pass < 6; pass++) for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const g = (gy * gw + gx) * 4;
    if (acc[g + 3] > 0) continue;
    let r = 0, gg = 0, bb = 0, n = 0;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = gx + ox, ny = gy + oy;
      if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
      const k = (ny * gw + nx) * 4;
      if (acc[k + 3] > 0) { r += acc[k] / acc[k + 3]; gg += acc[k + 1] / acc[k + 3]; bb += acc[k + 2] / acc[k + 3]; n++; }
    }
    if (n) { acc[g] = r / n; acc[g + 1] = gg / n; acc[g + 2] = bb / n; acc[g + 3] = 1; }
  }
  for (let p = 0; p < alpha.length; p++) {
    const a = alpha[p] / 255;
    if (a <= 0 || a >= 0.98) continue;
    const x = p % w, y = (p / w) | 0;
    const g = (((y / S) | 0) * gw + ((x / S) | 0)) * 4;
    const n = acc[g + 3]; if (!n) continue;
    const q = p * 4, ia = 1 - a;
    for (let c = 0; c < 3; c++) d[q + c] = (d[q + c] - ia * (acc[g + c] / n)) / a;
  }
}
