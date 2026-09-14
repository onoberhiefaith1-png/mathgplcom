// Photo-scanned PBR material registry (Poly Haven, CC0).
//
// Each family is a full map set — base colour, normal, roughness and ambient
// occlusion — so surfaces respond to light the way the real material does.
// The image files live on the CDN; only the pointer JSON is in the repo.

type Pointer = { url: string };

const pointers = import.meta.glob<Pointer>("../../assets/slate/pbr/*.asset.json", {
  eager: true,
  import: "default",
});

const urlFor = (name: string): string => {
  const entry = Object.entries(pointers).find(([path]) => path.endsWith(`/${name}.jpg.asset.json`));
  if (!entry) throw new Error(`missing PBR pointer: ${name}`);
  return entry[1].url;
};

export type PbrFamily =
  | "temple-stone"
  | "stone-floor"
  | "tablet-stone"
  | "wood"
  | "dark-wood"
  | "rust-metal"
  | "metal-plate"
  | "ice"
  | "parchment";

export interface PbrSet {
  map: string;
  normalMap: string;
  roughnessMap: string;
  aoMap: string;
  /** Base response of the material, before per-surface tuning. */
  roughness: number;
  metalness: number;
  normalScale: number;
  /** Neutral multiplier: colour comes from the scan, not from a tint. */
  tint: string;
}

const set = (
  name: string,
  roughness: number,
  metalness: number,
  normalScale: number,
  tint = "#ffffff",
): PbrSet => ({
  map: urlFor(`${name}_diff`),
  normalMap: urlFor(`${name}_nor`),
  roughnessMap: urlFor(`${name}_rough`),
  aoMap: urlFor(`${name}_ao`),
  roughness,
  metalness,
  normalScale,
  tint,
});

export const PBR_SETS: Record<PbrFamily, PbrSet> = {
  "temple-stone": set("temple-stone", 1, 0, 1),
  "stone-floor": set("stone-floor", 1, 0, 0.9),
  "tablet-stone": set("tablet-stone", 1, 0, 1),
  wood: set("wood", 1, 0, 0.9),
  "dark-wood": set("dark-wood", 1, 0, 0.85, "#c9b49c"),
  "rust-metal": set("rust-metal", 1, 0.85, 1),
  "metal-plate": set("metal-plate", 1, 0.95, 0.8),
  ice: set("ice", 1, 0, 0.55, "#eef6fb"),
  parchment: set("parchment", 1, 0, 0.7, "#e8dcc0"),
};

/** Slate surface id -> scanned material family. */
export const SURFACE_FAMILY: Record<string, PbrFamily> = {
  "stone-wall": "temple-stone",
  "stone-tablet": "tablet-stone",
  wood: "wood",
  door: "dark-wood",
  "metal-plate": "metal-plate",
  scroll: "parchment",
  chest: "dark-wood",
  shield: "rust-metal",
  glass: "ice",
  ice: "ice",
};

export const surfaceFamily = (surfaceId: string): PbrFamily =>
  SURFACE_FAMILY[surfaceId] ?? "temple-stone";

// ---- image-based lighting -------------------------------------------------

const hdr = (name: string): string => {
  const entry = Object.entries(
    import.meta.glob<Pointer>("../../assets/slate/hdr/*.asset.json", { eager: true, import: "default" }),
  ).find(([path]) => path.endsWith(`/${name}.hdr.asset.json`));
  if (!entry) throw new Error(`missing HDRI pointer: ${name}`);
  return entry[1].url;
};

export type EnvMood = "warm" | "cool" | "neutral";

export const HDRI: Record<EnvMood, string> = {
  warm: hdr("env-warm"),
  cool: hdr("env-cool"),
  neutral: hdr("env-neutral"),
};
