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
    jitter: 1, tones: [1, 0.9, 1.08, 0.94],
  },
  "stone-tablet": {
    gap: 0.13, recess: 0.095, bevel: 0.09, depth: 0.36, inset: 0.4,
    jitter: 0.8, tones: [1, 0.95, 1.05],
  },
  wood: {
    gap: 0.1, recess: 0.085, bevel: 0.08, depth: 0.32, inset: 0.34,
    jitter: 0.45, tones: [1, 0.86, 1.12, 0.93, 1.05], joints: true,
  },
  door: {
    gap: 0.12, recess: 0.055, bevel: 0.07, depth: 0.4, inset: 0.46,
    jitter: 0.5, tones: [1, 0.92, 1.06], joints: true, bands: true, rivets: true,
  },
  "metal-plate": {
    gap: 0.11, recess: 0.045, bevel: 0.05, depth: 0.26, inset: 0.38,
    jitter: 0.25, tones: [1, 0.95, 1.04], rivets: true,
  },
  scroll: {
    gap: 0.08, recess: 0.02, bevel: 0.03, depth: 0.1, inset: 0.3,
    jitter: 0.7, tones: [1, 0.97, 1.03],
  },
  chest: {
    gap: 0.12, recess: 0.05, bevel: 0.065, depth: 0.38, inset: 0.42,
    jitter: 0.5, tones: [1, 0.9, 1.08], joints: true, bands: true, rivets: true,
  },
  shield: {
    gap: 0.12, recess: 0.04, bevel: 0.055, depth: 0.24, inset: 0.4,
    jitter: 0.3, tones: [1, 0.96, 1.05], rivets: true, curve: 0.5,
  },
  glass: {
    gap: 0.14, recess: 0.03, bevel: 0.04, depth: 0.22, inset: 0.34,
    jitter: 0.15, tones: [1, 0.98, 1.02], frost: 0.55,
  },
  ice: {
    gap: 0.15, recess: 0.07, bevel: 0.08, depth: 0.44, inset: 0.4,
    jitter: 0.95, tones: [1, 0.94, 1.07, 0.9], frost: 1,
  },
};

const FALLBACK: Construction = {
  gap: 0.13, recess: 0.06, bevel: 0.07, depth: 0.36, inset: 0.4,
  jitter: 0.6, tones: [1, 0.95, 1.05],
};

export const getConstruction = (surfaceId: string): Construction =>
  CONSTRUCTION[surfaceId] ?? FALLBACK;

/** Deterministic per-section pseudo random, so a section always looks itself. */
export const seeded = (index: number, salt: number): number => {
  const v = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
};
