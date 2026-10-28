// Final Touch — one-revolution glitch clean-up.
//
// Every background setting in the building editor is normally guessed from a
// single frame. A rotating building shows dozens of frames, and the ones that
// were never looked at are exactly where halos, flicker and leftover backdrop
// patches appear. Final Touch watches a whole revolution, measures each of those
// problems on every sampled frame, and then picks one set of *existing* settings
// that holds for the worst frame — never just the prettiest one.
//
// Everything here is settings-only: no re-encode, no upload, no destructive edit.

import { analyseFrames, isLowSaturation, type KeyColor, type RawFrame } from "./bgAnalysis";
import { buildBackgroundMask, keyDistance, markBoundary } from "./flatCut";
import type { BlendMode, CanvasElement } from "./types";

/** Largest possible euclidean RGB distance — the chroma shader's own scale. */
const MAX_DIST = 441.6729559;

export type Verdict = "fixed" | "reduced" | "not-fixable" | "not-applicable";

export interface FinalTouchIssue {
  id: "backdrop" | "halo" | "flicker" | "seam";
  label: string;
  verdict: Verdict;
  detail: string;
}

export interface FinalTouchPatch {
  keyColor: KeyColor;
  keyTolerance: number;
  keyFeather: number;
  loopFade: number;
  blend?: BlendMode;
  bgRemoval?: "chroma";
}

export interface FinalTouchResult {
  ok: boolean;
  frames: number;
  patch: FinalTouchPatch | null;
  issues: FinalTouchIssue[];
  summary: string;
}

const euclid = (r: number, g: number, b: number, key: KeyColor) =>
  Math.hypot(r - key.r, g - key.g, b - key.b);

const luma = (c: KeyColor) => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Border-ring pixel indices of a frame (8% of each side), sub-sampled. */
const ringIndices = (w: number, h: number): number[] => {
  const bw = Math.max(1, Math.round(w * 0.08));
  const bh = Math.max(1, Math.round(h * 0.08));
  const step = Math.max(1, Math.round(Math.min(w, h) / 120));
  const out: number[] = [];
  for (let y = 0; y < h; y += step) {
    const edgeRow = y < bh || y >= h - bh;
    for (let x = 0; x < w; x += step) {
      if (!edgeRow && x >= bw && x < w - bw) continue;
      out.push(y * w + x);
    }
  }
  return out;
};

interface Measured {
  /** Fraction of ring pixels that look like backdrop but survived the cut. */
  leftover: number;
  /** Fraction of the frame the cut removes. */
  coverage: number;
  masks: Uint8Array;
}

const measureFrame = (
  frame: RawFrame,
  key: KeyColor,
  tolerance: number,
): Measured => {
  const { w, h, data } = frame;
  const neutral = isLowSaturation(key);
  const result = buildBackgroundMask(frame, key, { tolerance, protectInterior: true });
  const { mask } = result;
  let removed = 0;
  for (let p = 0; p < mask.length; p++) if (mask[p]) removed++;

  let ringBg = 0;
  let ringSurvived = 0;
  for (const p of ringIndices(w, h)) {
    const i = p * 4;
    const looksBg =
      keyDistance(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0, key, neutral) <= 0.5;
    if (!looksBg) continue;
    ringBg++;
    if (!mask[p]) ringSurvived++;
  }

  return {
    leftover: ringBg ? ringSurvived / ringBg : 0,
    coverage: mask.length ? removed / mask.length : 0,
    masks: mask,
  };
};

/** Mean perceptual distance of the boundary band to the key colour — the halo. */
const measureHalo = (frame: RawFrame, key: KeyColor, tolerance: number): number => {
  const result = buildBackgroundMask(frame, key, { tolerance, protectInterior: true });
  markBoundary(result, 2);
  const neutral = isLowSaturation(key);
  const { data } = frame;
  let sum = 0;
  let n = 0;
  for (let p = 0; p < result.mask.length; p++) {
    if (result.mask[p] !== 2) continue;
    const i = p * 4;
    sum += keyDistance(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0, key, neutral);
    n++;
  }
  return n ? sum / n : 0;
};

/**
 * 95th percentile euclidean distance of pixels the region cut treats as
 * backdrop. The playback keyer works in euclidean RGB, so this converts the
 * region-space decision into the tolerance that keyer actually needs.
 */
const chromaTolerance = (frames: RawFrame[], key: KeyColor, masks: Uint8Array[]): number => {
  const buckets = new Array(64).fill(0);
  let total = 0;
  frames.forEach((frame, fi) => {
    const mask = masks[fi];
    if (!mask) return;
    for (let p = 0; p < mask.length; p += 3) {
      if (!mask[p]) continue;
      const i = p * 4;
      const d = euclid(frame.data[i] ?? 0, frame.data[i + 1] ?? 0, frame.data[i + 2] ?? 0, key);
      const b = Math.min(63, Math.floor((d / MAX_DIST) * 64));
      buckets[b]++;
      total++;
    }
  });
  if (!total) return 0.12;
  let seen = 0;
  for (let b = 0; b < 64; b++) {
    seen += buckets[b];
    if (seen / total >= 0.95) return clamp((b + 1) / 64 + 0.02, 0.05, 0.6);
  }
  return 0.3;
};

/** Mean absolute RGB difference between two frames, 0..255. */
const frameDelta = (a: RawFrame, b: RawFrame): number => {
  if (a.w !== b.w || a.h !== b.h) return 0;
  let sum = 0;
  let n = 0;
  for (let p = 0; p < a.w * a.h; p += 5) {
    const i = p * 4;
    sum +=
      Math.abs((a.data[i] ?? 0) - (b.data[i] ?? 0)) +
      Math.abs((a.data[i + 1] ?? 0) - (b.data[i + 1] ?? 0)) +
      Math.abs((a.data[i + 2] ?? 0) - (b.data[i + 2] ?? 0));
    n += 3;
  }
  return n ? sum / n : 0;
};

/** Fraction of pixels whose cut decision flips between neighbouring frames. */
const flickerOf = (masks: Uint8Array[]): number => {
  if (masks.length < 2) return 0;
  let sum = 0;
  let pairs = 0;
  for (let i = 1; i < masks.length; i++) {
    const a = masks[i - 1]!;
    const b = masks[i]!;
    if (a.length !== b.length || !a.length) continue;
    let diff = 0;
    for (let p = 0; p < a.length; p++) if ((a[p] ? 1 : 0) !== (b[p] ? 1 : 0)) diff++;
    sum += diff / a.length;
    pairs++;
  }
  return pairs ? sum / pairs : 0;
};

const TOLERANCE_STEPS = [0.18, 0.24, 0.3, 0.36, 0.42, 0.48, 0.54, 0.6];

/**
 * Works out one settings set that keeps the whole loop clean.
 * `frames` must be in playback order, first to last.
 */
export const tuneFromLoop = (
  frames: RawFrame[],
  current: Partial<CanvasElement> = {},
): FinalTouchResult => {
  const usable = frames.filter((f) => f.w > 0 && f.h > 0);
  if (!usable.length) {
    return {
      ok: false,
      frames: 0,
      patch: null,
      issues: [],
      summary: "The building could not be read frame by frame.",
    };
  }

  const detection = analyseFrames(usable);
  const key = current.keyColor ?? detection.color;
  const singleFrame = usable.length < 2;

  if (!detection.keyable && !current.keyColor) {
    return {
      ok: false,
      frames: usable.length,
      patch: null,
      issues: [
        {
          id: "backdrop",
          label: "Leftover background",
          verdict: "not-fixable",
          detail: detection.reason,
        },
      ],
      summary: `Scanned ${usable.length} frames — this backdrop is not flat enough to key. Pick the background colour by hand, or use a clip with a plain backdrop.`,
    };
  }

  // Smallest tolerance that clears the backdrop in the WORST frame without
  // eating the building.
  let chosen = TOLERANCE_STEPS[TOLERANCE_STEPS.length - 1]!;
  let chosenMeasures: Measured[] = [];
  let bestLeftover = 1;
  for (const tol of TOLERANCE_STEPS) {
    const measures = usable.map((f) => measureFrame(f, key, tol));
    const worstLeftover = Math.max(...measures.map((m) => m.leftover));
    const worstCoverage = Math.max(...measures.map((m) => m.coverage));
    if (worstLeftover < bestLeftover) {
      bestLeftover = worstLeftover;
      chosen = tol;
      chosenMeasures = measures;
    }
    if (worstLeftover <= 0.02 && worstCoverage <= 0.94) {
      chosen = tol;
      chosenMeasures = measures;
      bestLeftover = worstLeftover;
      break;
    }
  }
  if (!chosenMeasures.length) chosenMeasures = usable.map((f) => measureFrame(f, key, chosen));

  const masks = chosenMeasures.map((m) => m.masks);
  const flicker = flickerOf(masks);
  const halo = Math.max(...usable.map((f) => measureHalo(f, key, chosen)));

  // Flicker means neighbouring frames disagree about the same pixel — one step
  // more tolerance and a wider feather makes the decision hold over time.
  const stable = flicker > 0.02;
  const finalTol = stable
    ? TOLERANCE_STEPS[Math.min(TOLERANCE_STEPS.length - 1, TOLERANCE_STEPS.indexOf(chosen) + 1)]!
    : chosen;
  const feather = clamp(Math.round(1 + halo * 8 + (stable ? 1 : 0)), 1, 6);

  const seamDelta = singleFrame ? 0 : frameDelta(usable[0]!, usable[usable.length - 1]!);
  const loopFade = seamDelta > 4 ? clamp(seamDelta / 40, 0.08, 0.4) : 0;

  const keyTolerance = chromaTolerance(usable, key, masks);
  const nearBlack = luma(key) < 26;
  const blend: BlendMode | undefined =
    nearBlack && detection.coverage > 0.8 ? "screen" : undefined;

  const worstLeftover = Math.max(...chosenMeasures.map((m) => m.leftover));
  const issues: FinalTouchIssue[] = [
    {
      id: "backdrop",
      label: "Leftover background",
      verdict: worstLeftover <= 0.02 ? "fixed" : worstLeftover <= 0.08 ? "reduced" : "not-fixable",
      detail:
        worstLeftover <= 0.02
          ? "The backdrop clears in every frame of the revolution."
          : `${Math.round(worstLeftover * 100)}% of the backdrop still survives in the worst frame.`,
    },
    {
      id: "halo",
      label: "Edge halo",
      verdict: halo <= 0.5 ? "fixed" : "reduced",
      detail: `Edge softness set to ${feather}px to hide the measured fringe.`,
    },
    {
      id: "flicker",
      label: "Flicker",
      verdict: singleFrame ? "not-applicable" : flicker <= 0.02 ? "fixed" : "reduced",
      detail: singleFrame
        ? "A still building cannot flicker."
        : `${(flicker * 100).toFixed(1)}% of pixels changed between frames — settings widened for a steady cut.`,
    },
    {
      id: "seam",
      label: "Loop seam",
      verdict: singleFrame ? "not-applicable" : loopFade > 0 ? "fixed" : "not-applicable",
      detail: singleFrame
        ? "A still building has no loop restart."
        : loopFade > 0
          ? `Crossfade of ${loopFade.toFixed(2)}s added over the restart.`
          : "First and last frame already match — no seam to smooth.",
    },
  ];

  return {
    ok: true,
    frames: usable.length,
    patch: {
      keyColor: key,
      keyTolerance,
      keyFeather: feather,
      loopFade,
      ...(blend ? { blend } : {}),
      bgRemoval: "chroma",
    },
    issues,
    summary: `Scanned ${usable.length} frames across one revolution — ${issues
      .filter((i) => i.verdict === "fixed")
      .length} of ${issues.filter((i) => i.verdict !== "not-applicable").length} checks clean.`,
  };
};

export { TOLERANCE_STEPS };
