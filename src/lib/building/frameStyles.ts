/**
 * FRAME & WINDOW PROFILES — pure architecture, never a picture.
 *
 * A profile describes how the Building system BUILDS a real 3D object: bar
 * thickness, depth, bevels, materials and ornaments. The artwork the teacher
 * later drops inside is a separate content layer, so the same physical frame can
 * show an assignment poster today and a course cover tomorrow.
 */

export type FrameKind = "frame" | "window";

export type FrameOrnament = "corner-scroll" | "corner-plate" | "light-strip" | "vine" | "none";

export interface FrameProfile {
  key: string;
  label: string;
  kind: FrameKind;
  /** default height ÷ width for a freshly hung object */
  ratio: number;
  /** bar thickness as a fraction of the object's width */
  bar: number;
  /** how far the object stands off the wall, metres */
  depth: number;
  /** main bar colour */
  face: string;
  /** raised bevel / accent colour */
  bevel: string;
  /** recessed backboard behind the picture */
  back: string;
  metalness: number;
  roughness: number;
  ornament: FrameOrnament;
  /** emissive accent (sci-fi light strips), when the style has one */
  glow?: string;
}

/** The four content frames, taken from the supplied reference sheet. */
export const FRAME_PROFILES: FrameProfile[] = [
  {
    key: "royal-gold",
    label: "Royal Gold",
    kind: "frame",
    ratio: 0.66,
    bar: 0.1,
    depth: 0.16,
    face: "#1d2c4d",
    bevel: "#d9a521",
    back: "#111a2e",
    metalness: 0.85,
    roughness: 0.28,
    ornament: "corner-scroll",
  },
  {
    key: "brass-walnut",
    label: "Brass & Walnut",
    kind: "frame",
    ratio: 0.66,
    bar: 0.11,
    depth: 0.15,
    face: "#6b3a22",
    bevel: "#c8a24a",
    back: "#1a1410",
    metalness: 0.35,
    roughness: 0.55,
    ornament: "corner-plate",
  },
  {
    key: "scifi-steel",
    label: "Sci-Fi Steel",
    kind: "frame",
    ratio: 0.63,
    bar: 0.09,
    depth: 0.18,
    face: "#8b939c",
    bevel: "#4a5566",
    back: "#0d1420",
    metalness: 0.9,
    roughness: 0.25,
    ornament: "light-strip",
    glow: "#2f86ff",
  },
  {
    key: "vine-oak",
    label: "Vine Oak",
    kind: "frame",
    ratio: 0.66,
    bar: 0.12,
    depth: 0.15,
    face: "#9a6636",
    bevel: "#c79a52",
    back: "#221812",
    metalness: 0.15,
    roughness: 0.72,
    ornament: "vine",
  },
];

/**
 * Window surrounds, built in the same architectural language as the existing
 * doors (navy trim, brushed steel, warm oak) but in window proportions.
 */
export const WINDOW_PROFILES: FrameProfile[] = [
  {
    key: "navy-trim",
    label: "Navy Trim Window",
    kind: "window",
    ratio: 0.72,
    bar: 0.075,
    depth: 0.22,
    face: "#1a2542",
    bevel: "#3a5786",
    back: "#0a1122",
    metalness: 0.45,
    roughness: 0.42,
    ornament: "none",
  },
  {
    key: "steel-trim",
    label: "Brushed Steel Window",
    kind: "window",
    ratio: 0.72,
    bar: 0.07,
    depth: 0.24,
    face: "#7e878f",
    bevel: "#3f4855",
    back: "#0d1420",
    metalness: 0.85,
    roughness: 0.3,
    ornament: "light-strip",
    glow: "#63b3ff",
  },
  {
    key: "oak-trim",
    label: "Warm Oak Window",
    kind: "window",
    ratio: 0.75,
    bar: 0.085,
    depth: 0.2,
    face: "#8a5a30",
    bevel: "#c79a52",
    back: "#1d1510",
    metalness: 0.12,
    roughness: 0.7,
    ornament: "none",
  },
];

export const ALL_PROFILES = [...FRAME_PROFILES, ...WINDOW_PROFILES];

export const profilesFor = (kind: FrameKind): FrameProfile[] =>
  kind === "window" ? WINDOW_PROFILES : FRAME_PROFILES;

/**
 * Older frames were stored against the retired artwork keys. They keep working
 * by mapping onto the nearest built profile, so nothing a teacher hung is lost.
 */
const LEGACY: Record<string, string> = {
  assignment: "royal-gold",
  adventure: "vine-oak",
  courses: "brass-walnut",
};

export const frameProfile = (key: string | null | undefined, kind: FrameKind = "frame"): FrameProfile => {
  const wanted = LEGACY[key ?? ""] ?? key ?? "";
  const list = profilesFor(kind);
  return list.find((p) => p.key === wanted) ?? list[0];
};
