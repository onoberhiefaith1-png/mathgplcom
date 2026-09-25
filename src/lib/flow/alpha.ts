// Transparency detection for Flow character videos.
//
// Three possible cases for an uploaded clip:
//  "alpha"   — the file carries a real alpha channel (e.g. WebM VP8/VP9 with
//              alpha). Transparency is preserved as-is, nothing is processed.
//  "checker" — an opaque file that has the editor's transparency checkerboard
//              baked into its pixels. A live GPU pass converts that pattern
//              back into real transparency during playback.
//  "opaque"  — an ordinary video with a real filmed background. Nothing is
//              removed automatically; the user is told it has no transparency.
import { detectChecker } from "@/lib/flow/checkerKey";

export type Transparency = "alpha" | "checker" | "opaque";

const cache = new Map<string, Transparency>();

/** Reads the first frame of a decoded video element. Null while undecodable. */
export const probeTransparency = (video: HTMLVideoElement, key: string): Transparency | null => {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return null;
  const sw = Math.min(360, w);
  const sh = Math.max(1, Math.round((h / w) * sw));
  const c = document.createElement("canvas");
  c.width = sw; c.height = sh;
  const ctx = c.getContext("2d", { willReadFrequently: true, alpha: true });
  if (!ctx) return null;
  try {
    ctx.clearRect(0, 0, sw, sh);
    ctx.drawImage(video, 0, 0, sw, sh);
    const frame = ctx.getImageData(0, 0, sw, sh);
    const d = frame.data;
    // Real alpha channel: a meaningful share of pixels are not fully opaque.
    let clear = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 250) clear++;
    const total = d.length / 4;
    let result: Transparency;
    if (clear / total > 0.02) result = "alpha";
    else result = detectChecker(frame) ? "checker" : "opaque";
    cache.set(key, result);
    return result;
  } catch {
    return null; // tainted or not decodable yet
  }
};

/** Loads a URL just far enough to classify its transparency. */
export const probeTransparencyFromUrl = async (url: string, key = url): Promise<Transparency | null> => {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    const done = (r: Transparency | null) => {
      v.removeAttribute("src");
      v.load();
      resolve(r);
    };
    v.onloadeddata = () => {
      const seek = () => {
        const r = probeTransparency(v, key);
        done(r);
      };
      if (v.currentTime < 0.05) {
        v.onseeked = seek;
        try { v.currentTime = Math.min(0.2, (v.duration || 1) / 2); } catch { seek(); }
      } else seek();
    };
    v.onerror = () => done(null);
    v.src = url;
  });
};
