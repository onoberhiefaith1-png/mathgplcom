// How a writing section is physically built, per surface.
//
// This is the construction language of the material: a wooden wall is stacked
// timber with joints and gaps, a stone wall is carved blocks with chipped
// edges, a shield curves. Nothing here is a rectangular UI panel.

export interface Construction {
  /** Physical gap between two sections, in world units. */
  gap: number;
  /** Depth of the carved writing bed below the face. */
  recess: number;
  /** Thickness of the bevelled rim around the bed. */
  bevel: number;
  /** Thickness of the section slab itself. */
  depth: number;
  /** How far the bed is inset from the section edge. */
  inset: number;
  /** Edge irregularity (0 = machined, 1 = broken rock). */
  jitter: number;
  /** Tint multipliers cycled across sections so no two look identical. */
  tones: number[];
  /** Horizontal timber joint strips at the section edges. */
  joints?: boolean;
  /** Vertical metal banding across the section. */
  bands?: boolean;
  /** Rivets / bolts along the rim. */
  rivets?: boolean;
  /** Curvature of the shell, in radians of arc (shield / armour). */
  curve?: number;
  /** Frosted / etched rim glow strength for ice and glass. */
  frost?: number;
}

const CONSTRUCTION: Record<string, Construction> = {
  "stone-wall": {
    gap: 0.16, recess: 0.11, bevel: 0.1, depth: 0.42, inset: 0.42,
    jitter: 0.16, tones: [1, 0.98, 1.02],
  },
  "stone-tablet": {
    gap: 0.13, recess: 0.095, bevel: 0.09, depth: 0.36, inset: 0.4,
    jitter: 0.14, tones: [1, 0.98, 1.02],
  },
  wood: {
    gap: 0.1, recess: 0.085, bevel: 0.08, depth: 0.32, inset: 0.34,
    jitter: 0.1, tones: [1, 0.98, 1.02], joints: true,
  },
  door: {
    gap: 0.12, recess: 0.055, bevel: 0.07, depth: 0.4, inset: 0.46,
    jitter: 0.08, tones: [1, 0.98, 1.02], joints: true, bands: true, rivets: true,
  },
  "metal-plate": {
    gap: 0.11, recess: 0.045, bevel: 0.05, depth: 0.26, inset: 0.38,
    jitter: 0, tones: [1], rivets: true,
  },
  scroll: {
    gap: 0.08, recess: 0.02, bevel: 0.03, depth: 0.1, inset: 0.3,
    jitter: 0.1, tones: [1, 0.99, 1.01],
  },
  chest: {
    gap: 0.12, recess: 0.05, bevel: 0.065, depth: 0.38, inset: 0.42,
    jitter: 0.1, tones: [1, 0.98, 1.02], joints: true, bands: true, rivets: true,
  },
  shield: {
    gap: 0.12, recess: 0.04, bevel: 0.055, depth: 0.24, inset: 0.4,
    jitter: 0, tones: [1], rivets: true, curve: 0.5,
  },
  glass: {
    gap: 0.14, recess: 0.03, bevel: 0.04, depth: 0.22, inset: 0.34,
    jitter: 0.15, tones: [1, 0.98, 1.02], frost: 0.55,
  },
  ice: {
    gap: 0.15, recess: 0.07, bevel: 0.08, depth: 0.44, inset: 0.4,
    jitter: 0.14, tones: [1, 0.98, 1.02], frost: 1,
  },
  "royal-paper": {
    gap: 0.1, recess: 0.025, bevel: 0.055, depth: 0.12, inset: 0.24,
    jitter: 0.12, tones: [1, 0.98, 1.03],
  },
  "leaf-frame": {
    gap: 0.1, recess: 0.025, bevel: 0.045, depth: 0.12, inset: 0.26,
    jitter: 0.32, tones: [1, 0.96, 1.04],
  },
  "magical-aura": {
    gap: 0.1, recess: 0.02, bevel: 0.045, depth: 0.11, inset: 0.24,
    jitter: 0.15, tones: [1, 0.98, 1.03], frost: 0.8,
  },
  cloud: {
    gap: 0.1, recess: 0.01, bevel: 0.035, depth: 0.1, inset: 0.28,
    jitter: 0.5, tones: [1, 0.98, 1.02],
  },
  "silk-ribbon": {
    gap: 0.1, recess: 0.018, bevel: 0.035, depth: 0.09, inset: 0.25,
    jitter: 0.18, tones: [1, 0.97, 1.03],
  },
  none: {
    gap: 0.12, recess: 0, bevel: 0, depth: 0, inset: 0.22,
    jitter: 0, tones: [1],
  },
  plain: { gap: 0.12, recess: 0.018, bevel: 0.035, depth: 0.1, inset: 0.24, jitter: 0, tones: [1] },
  "new-parchment-scroll": { gap: 0.1, recess: 0.018, bevel: 0.035, depth: 0.14, inset: 0.38, jitter: 0.35, tones: [1] },
  "new-royal-plaque": { gap: 0.11, recess: 0.05, bevel: 0.065, depth: 0.2, inset: 0.46, jitter: 0, tones: [1] },
  "new-crystal-glass": { gap: 0.12, recess: 0.028, bevel: 0.075, depth: 0.24, inset: 0.4, jitter: 0, tones: [1], frost: 0.38 },
  "new-wooden-sign": { gap: 0.11, recess: 0.03, bevel: 0.055, depth: 0.2, inset: 0.3, jitter: 0.28, tones: [1] },
  "new-stone-tablet": { gap: 0.12, recess: 0.055, bevel: 0.075, depth: 0.28, inset: 0.34, jitter: 0.5, tones: [1] },
  "new-leaf-frame": { gap: 0.11, recess: 0.02, bevel: 0.035, depth: 0.11, inset: 0.38, jitter: 0.18, tones: [1] },
  "new-magical-aura": { gap: 0.11, recess: 0.022, bevel: 0.05, depth: 0.16, inset: 0.4, jitter: 0, tones: [1], frost: 0.45 },
  "new-cloud-panel": { gap: 0.12, recess: 0.012, bevel: 0.04, depth: 0.2, inset: 0.42, jitter: 0.3, tones: [1] },
  "new-metal-plate": { gap: 0.11, recess: 0.04, bevel: 0.05, depth: 0.18, inset: 0.3, jitter: 0, tones: [1], rivets: true },
  "new-silk-ribbon": { gap: 0.11, recess: 0.018, bevel: 0.04, depth: 0.13, inset: 0.4, jitter: 0, tones: [1] },
  // nothing is built: the writing area is pure space with a faint outline
  transparent: {
    gap: 0.12, recess: 0, bevel: 0, depth: 0.02, inset: 0.3,
    jitter: 0, tones: [1],
  },
};

const FALLBACK: Construction = {
  gap: 0.13, recess: 0.06, bevel: 0.07, depth: 0.36, inset: 0.4,
  jitter: 0.6, tones: [1, 0.95, 1.05],
};

export const getConstruction = (surfaceId: string): Construction =>
  CONSTRUCTION[surfaceId] ?? FALLBACK;

/**
 * The decorative rolled / folded / bevelled border of a surface. Writing is
 * never allowed on it, so this much of each side is removed from the content
 * region before text is laid out.
 */
export const surfaceFoldInset = (build: Construction): number =>
  Math.max(0, build.inset * 0.35 + build.bevel * 0.5);

/** Deterministic per-section pseudo random, so a section always looks itself. */
export const seeded = (index: number, salt: number): number => {
  const v = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
};
