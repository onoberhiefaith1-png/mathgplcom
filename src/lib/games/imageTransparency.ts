// "Clean transparency" for building and asset uploads. No AI, no network.
//
// Three situations are handled, in this order, and none of them ever removes
// a genuine scene background (that stays a separate, explicit fallback):
//   1. Real alpha: kept exactly. Only fully transparent pixels are tidied.
//   2. A checkerboard "transparency preview" baked into the pixels (common in
//      AI renders): converted into real alpha with the lesson-note Flow keyer's
//      checker model (detectChecker / segDist / removeSpecks).
//   3. Both: a PNG with real transparent padding around a baked checker.
//
// The checker keyer here is stricter than Flow's video keyer. A pixel only
// counts as checker when, within about one square, BOTH checker colours appear
// horizontally AND vertically. Flat white stone, pale walls and white glass do
// not alternate, so they survive even when they touch the checker directly,
// and an open doorway or window that shows the checker is still keyed out
// (it alternates), whether it opens to the frame edge or is fully enclosed.

import { detectChecker, removeSpecks, segDist, type CheckerModel } from "@/lib/flow/checkerKey";

/** Minimal ImageData shape so the maths runs in tests without a DOM. */
export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export type TransparencyKind = "alpha" | "checker" | "alpha+checker" | "opaque";

export interface TransparencyReport {
  kind: TransparencyKind;
  /** Pixels whose alpha is below 250 after cleaning. */
  transparentPixels: number;
  totalPixels: number;
}

const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/** True when the picture already carries meaningful transparency. */
export function hasRealAlpha(img: Pixels): boolean {
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
  return false;
}

/** Typical checker square size, from colour runs along the top and left rows. */
function squareSize(m: CheckerModel, img: Pixels): number {
  const { data: d, width: w, height: h } = img;
  const la = luma(...m.a), lb = luma(...m.b), mid = (la + lb) / 2;
  const runs: number[] = [];
  const scan = (n: number, at: (i: number) => number) => {
    let prev = at(0) > mid, len = 1;
    for (let i = 1; i < n; i++) {
      const cur = at(i) > mid;
      if (cur === prev) len++;
      else { runs.push(len); len = 1; prev = cur; }
    }
  };
  const L = (x: number, y: number) => { const q = (y * w + x) * 4; return luma(d[q], d[q + 1], d[q + 2]); };
  const y0 = Math.min(2, h - 1), x0 = Math.min(2, w - 1);
  scan(w, (x) => L(x, y0));
  scan(h, (y) => L(x0, y));
  if (!runs.length) return 8;
  runs.sort((a, b) => a - b);
  return Math.max(2, Math.min(96, runs[Math.floor(runs.length / 2)]));
}

const LO = 16, HI = 44; // Flow's "normal" keying levels.

/**
 * Key a baked checkerboard into alpha, in place. `keep` (optional) marks
 * pixels already transparent in the source; they seed the background so a
 * checker framed by real transparency is reached too.
 */
export function keyBakedChecker(m: CheckerModel, img: Pixels, keep?: Uint8Array): Float32Array {
  const { data: d, width: w, height: h } = img;
  const N = w * h;
  const s = squareSize(m, img);
  const R = Math.ceil(s * 1.3);
  const la = luma(...m.a), lb = luma(...m.b), gap = Math.abs(la - lb);

  const raw = new Float32Array(N), tt = new Float32Array(N);
  const isA = new Uint8Array(N), isB = new Uint8Array(N), onLine = new Uint8Array(N);
  for (let p = 0, q = 0; p < N; p++, q += 4) {
    const { dist, t } = segDist(m, d[q], d[q + 1], d[q + 2]);
    tt[p] = t;
    raw[p] = dist <= LO ? 0 : dist >= HI ? 255 : ((dist - LO) / (HI - LO)) * 255;
    if (dist < 20) {
      onLine[p] = 1;
      const l = luma(d[q], d[q + 1], d[q + 2]);
      if (Math.abs(l - la) < gap * 0.3) isA[p] = 1;
      else if (Math.abs(l - lb) < gap * 0.3) isB[p] = 1;
    }
  }
  // A pixel may be checker when it IS one of the two checker colours, or is a
  // blurred square boundary (on the colour line, within 2 px of one). A wide
  // pale wall whose colour sits between the two never qualifies.
  const member = new Uint8Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x;
    if (isA[p] || isB[p]) { member[p] = 1; continue; }
    if (!onLine[p]) continue;
    for (let k = 1; k <= 2 && !member[p]; k++) {
      if ((x - k >= 0 && (isA[p - k] || isB[p - k])) || (x + k < w && (isA[p + k] || isB[p + k])) ||
          (y - k >= 0 && (isA[p - k * w] || isB[p - k * w])) || (y + k < h && (isA[p + k * w] || isB[p + k * w]))) member[p] = 1;
    }
  }

  // Alternation test with running counts along rows and columns.
  const alt = new Uint8Array(N);
  const rowA = new Int32Array(w + 1), rowB = new Int32Array(w + 1);
  const horiz = new Uint8Array(N);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) { const p = y * w + x; rowA[x + 1] = rowA[x] + isA[p]; rowB[x + 1] = rowB[x] + isB[p]; }
    for (let x = 0; x < w; x++) {
      const lo = Math.max(0, x - R), hi = Math.min(w, x + R + 1);
      if (rowA[hi] - rowA[lo] > 0 && rowB[hi] - rowB[lo] > 0) horiz[y * w + x] = 1;
    }
  }
  const colA = new Int32Array(h + 1), colB = new Int32Array(h + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) { const p = y * w + x; colA[y + 1] = colA[y] + isA[p]; colB[y + 1] = colB[y] + isB[p]; }
    for (let y = 0; y < h; y++) {
      const lo = Math.max(0, y - R), hi = Math.min(h, y + R + 1);
      const p = y * w + x;
      if (member[p] && horiz[p] && raw[p] < 200 && colA[hi] - colA[lo] > 0 && colB[hi] - colB[lo] > 0) alt[p] = 1;
    }
  }

  // Background = checker components touching the frame edge or real
  // transparency, plus enclosed checker areas (open windows) at least a
  // couple of squares big.
  const bg = new Uint8Array(N);
  const seen = new Uint8Array(N);
  const minEnclosed = Math.max(24, Math.round(s * s * 2));
  const stack: number[] = [];
  const comp: number[] = [];
  for (let start = 0; start < N; start++) {
    if (!alt[start] || seen[start]) continue;
    comp.length = 0; stack.push(start); seen[start] = 1;
    let touches = false;
    while (stack.length) {
      const p = stack.pop()!; comp.push(p);
      const x = p % w, y = (p - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touches = true;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const n of nb) {
        if (n < 0) continue;
        if (keep && keep[n]) touches = true;
        if (alt[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
      }
    }
    if (touches || comp.length >= minEnclosed) for (const p of comp) bg[p] = 1;
  }

  // Soft outline: two pixels next to the background that sit partway along
  // the checker line keep a graded alpha instead of a hard grey fringe.
  const alpha = new Float32Array(N);
  for (let p = 0; p < N; p++) alpha[p] = bg[p] ? raw[p] : 255;
  let ring = bg;
  for (let pass = 0; pass < 2; pass++) {
    const next = new Uint8Array(N);
    for (let p = 0; p < N; p++) {
      if (ring[p] || bg[p]) continue;
      const x = p % w;
      const near = (x > 0 && ring[p - 1]) || (x < w - 1 && ring[p + 1]) || (p >= w && ring[p - w]) || (p < N - w && ring[p + w]);
      if (!near) continue;
      next[p] = 1;
      if (raw[p] > 0 && raw[p] < 255 && tt[p] > -0.05 && tt[p] < 1.05) alpha[p] = Math.min(alpha[p], raw[p]);
    }
    const merged = new Uint8Array(N);
    for (let p = 0; p < N; p++) merged[p] = ring[p] | next[p];
    ring = merged;
  }
  removeSpecks(alpha, w, h, Math.max(30, Math.round(N * 0.0003)));

  // Un-mix the checker colour out of soft pixels; solid pixels untouched.
  for (let p = 0, q = 0; p < N; p++, q += 4) {
    const a = alpha[p] / 255;
    if (a > 0.02 && a < 0.98) {
      const t = Math.max(0, Math.min(1, tt[p])), ia = 1 - a;
      for (let c = 0; c < 3; c++) d[q + c] = (d[q + c] - ia * (m.a[c] + t * (m.b[c] - m.a[c]))) / a;
    }
    d[q + 3] = Math.round(alpha[p]);
  }
  return alpha;
}

/**
 * Flow's detector reads the top and bottom bands. A building usually stands
 * on the bottom edge, so when the full frame doesn't qualify, look for the
 * checker in a strip along the top edge alone (and then the bottom edge).
 */
export function detectBakedChecker(img: Pixels): CheckerModel | null {
  const whole = detectChecker(img as ImageData);
  if (whole) return whole;
  const { data, width: w, height: h } = img;
  const rows = Math.max(8, Math.round(h * 0.12));
  if (h < rows * 2) return null;
  for (const y0 of [0, h - rows]) {
    const strip = { data: data.slice(y0 * w * 4, (y0 + rows) * w * 4), width: w, height: rows };
    const m = detectChecker(strip as ImageData);
    if (m) return m;
  }
  return null;
}

/** Bounding box of the (nearly) opaque pixels. */
function opaqueBox(img: Pixels) {
  const { data: d, width: w, height: h } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] >= 250) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * Restore transparency in place and say what was found. Opaque scenes are
 * returned untouched (kind "opaque"): removing a real backdrop is never done
 * here.
 */
export function recoverImageTransparency(img: Pixels): TransparencyKind {
  const { data: d, width: w, height: h } = img;
  if (hasRealAlpha(img)) {
    const box = opaqueBox(img);
    if (!box || box.w < 8 || box.h < 8) return "alpha";
    const crop = new Uint8ClampedArray(box.w * box.h * 4);
    for (let y = 0; y < box.h; y++) crop.set(d.subarray(((box.y0 + y) * w + box.x0) * 4, ((box.y0 + y) * w + box.x0 + box.w) * 4), y * box.w * 4);
    const cropImg = { data: crop, width: box.w, height: box.h };
    // Detection must not see the (often black) colour stored in transparent
    // pixels: show it the nearest visible pixel on the same row instead.
    const probe = new Uint8ClampedArray(crop);
    for (let y = 0; y < box.h; y++) {
      let last = -1;
      for (let pass = 0; pass < 2; pass++) for (let i = 0; i < box.w; i++) {
        const x = pass === 0 ? i : box.w - 1 - i, q = (y * box.w + x) * 4;
        if (probe[q + 3] >= 8 && crop[q + 3] >= 8) last = q;
        else if (last >= 0 && crop[q + 3] < 8) { probe[q] = probe[last]; probe[q + 1] = probe[last + 1]; probe[q + 2] = probe[last + 2]; }
      }
    }
    const model = detectBakedChecker({ data: probe, width: box.w, height: box.h });
    if (!model) return "alpha";
    const origAlpha = new Uint8Array(box.w * box.h);
    const keep = new Uint8Array(box.w * box.h);
    for (let p = 0; p < origAlpha.length; p++) { origAlpha[p] = crop[p * 4 + 3]; if (origAlpha[p] < 8) keep[p] = 1; }
    keyBakedChecker(model, cropImg, keep);
    // Never make anything MORE opaque than the source (semi-transparent glass
    // stays as it was); keep the source colour where it was already see-through.
    for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) {
      const p = y * box.w + x, q = ((box.y0 + y) * w + box.x0 + x) * 4;
      const a = Math.min(origAlpha[p], crop[p * 4 + 3]);
      if (origAlpha[p] >= 250) { d[q] = crop[p * 4]; d[q + 1] = crop[p * 4 + 1]; d[q + 2] = crop[p * 4 + 2]; }
      d[q + 3] = a;
    }
    return "alpha+checker";
  }
  if (w < 8 || h < 8) return "opaque";
  const model = detectBakedChecker(img);
  if (!model) return "opaque";
  keyBakedChecker(model, img);
  return hasRealAlpha(img) ? "checker" : "opaque";
}

/**
 * Edge tidy that never changes what is visible: fully transparent pixels get
 * the colour of their nearest visible neighbours (so texture filtering in 3D
 * can't bleed an old white/grey backdrop into a halo), and thin
 * semi-transparent OUTLINE pixels with a pale matte colour take the colour of
 * the adjacent solid subject. Semi-transparent glass inside a building is not
 * on the outline and keeps its colour and alpha.
 */
export function cleanAlphaEdges(img: Pixels): void {
  const { data: d, width: w, height: h } = img;
  const N = w * h;
  const A = (p: number) => d[p * 4 + 3];
  const clear = new Uint8Array(N);
  for (let p = 0; p < N; p++) if (A(p) <= 8) { clear[p] = 1; d[p * 4 + 3] = 0; }
  // Outline matte decontamination.
  const src = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x, q = p * 4, a = src[q + 3];
    if (a <= 8 || a >= 245) continue;
    const touchesClear = (x > 0 && clear[p - 1]) || (x < w - 1 && clear[p + 1]) || (y > 0 && clear[p - w]) || (y < h - 1 && clear[p + w]);
    if (!touchesClear) continue;
    const mx = Math.max(src[q], src[q + 1], src[q + 2]), mn = Math.min(src[q], src[q + 1], src[q + 2]);
    if (mx - mn > 24 || mx < 120) continue; // only grey/white matte contamination
    let r = 0, g = 0, b = 0, n = 0;
    for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) {
      const nx = x + ox, ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nq = (ny * w + nx) * 4;
      if (src[nq + 3] < 245) continue;
      r += src[nq]; g += src[nq + 1]; b += src[nq + 2]; n++;
    }
    if (n) { d[q] = r / n; d[q + 1] = g / n; d[q + 2] = b / n; }
  }
  // Bleed colour outward into invisible pixels (a few passes is enough for
  // mipmapped textures).
  let frontier = clear;
  for (let pass = 0; pass < 4; pass++) {
    const next = new Uint8Array(frontier);
    const snap = new Uint8ClampedArray(d);
    let changed = false;
    for (let p = 0; p < N; p++) {
      if (!frontier[p]) continue;
      const x = p % w;
      let r = 0, g = 0, b = 0, n = 0;
      for (const nb of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < N - w ? p + w : -1]) {
        if (nb < 0 || frontier[nb]) continue;
        r += snap[nb * 4]; g += snap[nb * 4 + 1]; b += snap[nb * 4 + 2]; n++;
      }
      if (n) { d[p * 4] = r / n; d[p * 4 + 1] = g / n; d[p * 4 + 2] = b / n; next[p] = 0; changed = true; }
    }
    frontier = next;
    if (!changed) break;
  }
  for (let p = 0; p < N; p++) if (frontier[p]) { d[p * 4] = 0; d[p * 4 + 1] = 0; d[p * 4 + 2] = 0; }
}

/** Recover + tidy edges. Returns what was found; `img` is updated in place. */
export function cleanImageTransparency(img: Pixels): TransparencyReport {
  const kind = recoverImageTransparency(img);
  if (kind !== "opaque") cleanAlphaEdges(img);
  let transparentPixels = 0;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] < 250) transparentPixels++;
  return { kind, transparentPixels, totalPixels: img.width * img.height };
}

export class TransparencyCleanupError extends Error {
  constructor(public code: "decode" | "encode" | "canvas", message: string) {
    super(message);
    this.name = "TransparencyCleanupError";
  }
}

export interface CleanedImage extends TransparencyReport {
  /** Lossless PNG with real alpha; null when the image is opaque (nothing to clean). */
  blob: Blob | null;
  width: number;
  height: number;
}

export interface CleanupDeps {
  decode?: (blob: Blob) => Promise<{ width: number; height: number; pixels: Pixels; close?: () => void }>;
  encode?: (img: Pixels) => Promise<Blob>;
}

const browserDecode: NonNullable<CleanupDeps["decode"]> = async (blob) => {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new TransparencyCleanupError("canvas", "This browser could not open a drawing canvas for the image.");
    ctx.drawImage(bitmap, 0, 0);
    const pixels = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    return { width: bitmap.width, height: bitmap.height, pixels };
  } finally {
    bitmap.close();
  }
};

const browserEncode: NonNullable<CleanupDeps["encode"]> = (img) =>
  new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new TransparencyCleanupError("canvas", "This browser could not open a drawing canvas for the image."));
    ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
    // PNG: lossless and always keeps the alpha channel.
    canvas.toBlob((b) => (b ? resolve(b) : reject(new TransparencyCleanupError("encode", "Saving the cleaned image as PNG failed."))), "image/png");
  });

/**
 * Browser entry point. Never touches the caller's original file: the caller
 * keeps it until it decides to use (and successfully saves) the cleaned blob.
 */
export async function cleanTransparencyFile(file: Blob, deps: CleanupDeps = {}): Promise<CleanedImage> {
  let decoded;
  try {
    decoded = await (deps.decode ?? browserDecode)(file);
  } catch (err) {
    if (err instanceof TransparencyCleanupError) throw err;
    throw new TransparencyCleanupError(
      "decode",
      "This image could not be read (it may be damaged or in an unsupported format). Try another PNG, WebP or JPEG, or keep the original.",
    );
  }
  const report = cleanImageTransparency(decoded.pixels);
  if (report.kind === "opaque") return { ...report, blob: null, width: decoded.width, height: decoded.height };
  const blob = await (deps.encode ?? browserEncode)(decoded.pixels);
  return { ...report, blob, width: decoded.width, height: decoded.height };
}

export const TRANSPARENCY_KIND_LABEL: Record<TransparencyKind, string> = {
  alpha: "Existing transparency kept; edges tidied.",
  checker: "Baked checkerboard preview converted into real transparency.",
  "alpha+checker": "Existing transparency kept and a baked checkerboard inside it removed.",
  opaque: "No transparency or checkerboard found. Nothing was removed; use the background-removal fallback if this picture has a real backdrop to cut out.",
};
