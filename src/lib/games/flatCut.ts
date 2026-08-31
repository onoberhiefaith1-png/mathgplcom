// Region-aware flat-background cutting.
//
// Colour keying alone deletes every pixel close to the backdrop colour, wherever
// it sits — so white signage, glass and highlights *inside* a building are cut
// away with the white sky behind it. This module cuts by region instead: the
// background is whatever is connected to the outer edge of the frame through
// background-coloured pixels. Anything the flood fill cannot reach stays fully
// opaque and byte-identical to the source.

import { isLowSaturation, type KeyColor, type RawFrame } from "./bgAnalysis";

export interface FlatCutOptions {
  /** 0..1 — how far a pixel may drift from the key colour and still be backdrop. */
  tolerance?: number;
  /** Feather radius, in pixels, applied to the boundary band only. */
  feather?: number;
  /** When false, falls back to plain global colour keying. */
  protectInterior?: boolean;
}

export const DEFAULT_TOLERANCE = 0.42;

const LUMA = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/**
 * Perceptual distance to the key colour, 0..~1. Neutral keys (white/grey/black)
 * carry no hue, so brightness carries most of the weight for them.
 */
export const keyDistance = (
  r: number,
  g: number,
  b: number,
  key: KeyColor,
  neutralKey: boolean,
): number => {
  const py = LUMA(r, g, b);
  const ky = LUMA(key.r, key.g, key.b);
  const pcb = b - py;
  const pcr = r - py;
  const kcb = key.b - ky;
  const kcr = key.r - ky;
  const chroma = Math.hypot(pcb - kcb, pcr - kcr) / 180;
  const luma = Math.abs(py - ky) / 255;
  return neutralKey ? luma * 0.75 + chroma * 0.9 : chroma * 0.8 + luma * 0.3;
};

export interface MaskResult {
  /** 0 = keep (subject), 1 = background, 2 = boundary band. */
  mask: Uint8Array;
  w: number;
  h: number;
}

/** True when this pixel is close enough to the key colour to be backdrop. */
const isBg = (
  data: Uint8ClampedArray | number[],
  i: number,
  key: KeyColor,
  neutral: boolean,
  tol: number,
) => {
  if ((data[i + 3] ?? 255) < 8) return true; // already transparent
  return keyDistance(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0, key, neutral) <= tol;
};

/**
 * Flood fills the backdrop inwards from every border pixel that matches the key
 * colour. The subject blocks propagation, so colours enclosed by the subject are
 * never marked as background.
 */
export const buildBackgroundMask = (
  frame: RawFrame,
  key: KeyColor,
  opts: FlatCutOptions = {},
): MaskResult => {
  const { w, h, data } = frame;
  const tol = opts.tolerance ?? DEFAULT_TOLERANCE;
  const neutral = isLowSaturation(key);
  const mask = new Uint8Array(w * h);

  if (opts.protectInterior === false) {
    for (let p = 0; p < w * h; p++) {
      if (isBg(data, p * 4, key, neutral, tol)) mask[p] = 1;
    }
    return { mask, w, h };
  }

  const stack: number[] = [];
  const push = (p: number) => {
    if (mask[p]) return;
    if (!isBg(data, p * 4, key, neutral, tol)) return;
    mask[p] = 1;
    stack.push(p);
  };

  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }

  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (y > 0) push(p - w);
    if (y < h - 1) push(p + w);
  }

  closePinholes(mask, w, h);
  return { mask, w, h };
};

/**
 * Fills single-pixel gaps left by noise: a kept pixel surrounded on all four
 * sides by background is background too.
 */
const closePinholes = (mask: Uint8Array, w: number, h: number) => {
  const fill: number[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (mask[p]) continue;
      if (mask[p - 1] && mask[p + 1] && mask[p - w] && mask[p + w]) fill.push(p);
    }
  }
  for (const p of fill) mask[p] = 1;
};

/**
 * Marks background pixels that touch the subject as the boundary band (2) and
 * reports how deep into the background each band pixel sits: depth 1 is the
 * pixel touching the subject, depth `radius` is the outermost band pixel. That
 * depth is what turns a hard cut into a graded, anti-aliased edge.
 */
export const markBoundary = ({ mask, w, h }: MaskResult, radius = 1): Uint8Array => {
  const depth = new Uint8Array(w * h);
  const rings = Math.max(1, Math.round(radius));
  for (let r = 1; r <= rings; r++) {
    const band: number[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (mask[p] !== 1) continue;
        const near =
          (x > 0 && mask[p - 1] !== 1) ||
          (x < w - 1 && mask[p + 1] !== 1) ||
          (y > 0 && mask[p - w] !== 1) ||
          (y < h - 1 && mask[p + w] !== 1);
        if (near) band.push(p);
      }
    }
    if (!band.length) break;
    for (const p of band) {
      mask[p] = 2;
      depth[p] = r;
    }
  }
  return depth;
};

/**
 * Applies the mask to the pixel buffer in place: background goes transparent,
 * the boundary band fades out across its full width with the key hue pulled out
 * of it, and every other pixel is left exactly as it came in.
 */
export const applyMaskToPixels = (
  data: Uint8ClampedArray,
  result: MaskResult,
  key: KeyColor,
  feather = DEFAULT_FEATHER,
) => {
  const rings = Math.max(1, Math.round(feather));
  const depth = markBoundary(result, rings);
  const { mask, w, h } = result;
  const total = w * h;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  for (let p = 0; p < total; p++) {
    const i = p * 4;
    const m = mask[p];
    if (m === 1) {
      data[i + 3] = 0;
      continue;
    }
    if (m !== 2) continue;
    // Graded alpha: opaque next to the subject, fading to nothing at the outer
    // edge of the band, so the cut has a soft anti-aliased edge instead of a
    // single hard step.
    const d = depth[p] || 1;
    const t = 1 - d / (rings + 1); // 0 < t <= rings/(rings+1)
    data[i + 3] = clamp((data[i + 3] ?? 255) * t);
    // De-spill scaled by the same weight: only genuinely mixed pixels get the
    // key hue removed, so nothing solid is tinted.
    const spill = 0.35 * (1 - t);
    data[i] = clamp((data[i] ?? 0) - (key.r - 128) * spill);
    data[i + 1] = clamp((data[i + 1] ?? 0) - (key.g - 128) * spill);
    data[i + 2] = clamp((data[i + 2] ?? 0) - (key.b - 128) * spill);
  }
};

/** Fraction of the frame the cut would remove — a sanity check for callers. */
export const maskCoverage = ({ mask }: MaskResult) => {
  let n = 0;
  for (let p = 0; p < mask.length; p++) if (mask[p] === 1 || mask[p] === 2) n++;
  return mask.length ? n / mask.length : 0;
};

/** Cuts one RGBA frame in place and reports how much was removed. */
export const cutFrame = (
  data: Uint8ClampedArray,
  w: number,
  h: number,
  key: KeyColor,
  opts: FlatCutOptions = {},
): number => {
  const result = buildBackgroundMask({ data, w, h }, key, opts);
  const coverage = maskCoverage(result);
  applyMaskToPixels(data, result, key, opts.feather ?? DEFAULT_FEATHER);
  return coverage;
};

