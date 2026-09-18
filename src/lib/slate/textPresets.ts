// The text style engine.
//
// A preset describes HOW a mathematical character behaves as a physical
// object. A base colour describes WHAT colour that object is. Everything the
// renderer needs — face gradient, bevel, side depth, outline, coloured
// shadow, contact shadow, glow — is derived from those two, so the teacher
// only ever picks a style and a colour.
//
//   preset -> colour harmonisation -> advanced overrides -> renderer

import type { SurfaceDef } from "./surfaces";
import type { TextSettings } from "./text3d";

export type TextPresetId = "royal3d" | "crystal" | "bubble" | "stone" | "neon";

export const TEXT_PRESETS: { id: TextPresetId; label: string; blurb: string }[] = [
  { id: "royal3d", label: "Royal 3D", blurb: "Polished, deep, premium" },
  { id: "crystal", label: "Crystal", blurb: "Translucent, lit from inside" },
  { id: "bubble", label: "Bubble", blurb: "Soft, rounded, playful" },
  { id: "stone", label: "Stone", blurb: "Carved into the material" },
  { id: "neon", label: "Neon", blurb: "Dark body, luminous edges" },
];

/** The five everyday colours. The picker still allows anything. */
export const PRESET_COLOURS: { label: string; value: string }[] = [
  { label: "Blue", value: "#0969ff" },
  { label: "Red", value: "#ff2f3d" },
  { label: "Green", value: "#00c95a" },
  { label: "Gold", value: "#ffb800" },
  { label: "Purple", value: "#9147ff" },
];

/* ------------------------------------------------------------------ colour */

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const mixN = (a: number, b: number, t: number) => a + (b - a) * t;

const rgb = (hex: string): [number, number, number] => {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.padEnd(6, "0").slice(0, 6);
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
};

const hex = (c: [number, number, number]) =>
  `#${c
    .map((v) =>
      Math.round(clamp(v, 0, 255))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

/** amount > 0 lightens toward white, < 0 darkens toward black. */
export const shade = (colour: string, amount: number) => {
  const [r, g, b] = rgb(colour);
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  return hex([mixN(r, target, t), mixN(g, target, t), mixN(b, target, t)]);
};

/** Blends two colours. */
export const blend = (a: string, b: string, t: number) => {
  const x = rgb(a);
  const y = rgb(b);
  return hex([mixN(x[0], y[0], t), mixN(x[1], y[1], t), mixN(x[2], y[2], t)]);
};

/** Pushes saturation without changing apparent brightness much. */
const saturate = (colour: string, amount: number) => {
  const [r, g, b] = rgb(colour);
  const grey = 0.299 * r + 0.587 * g + 0.114 * b;
  return hex([
    mixN(grey, r, 1 + amount),
    mixN(grey, g, 1 + amount),
    mixN(grey, b, 1 + amount),
  ]);
};

export interface TextPalette {
  face: string;
  faceHighlight: string;
  faceMid: string;
  faceShade: string;
  bevelHighlight: string;
  bevelShadow: string;
  side: string;
  outline: string;
  shadow: string;
  contact: string;
  glow: string;
  reflection: string;
}

/**
 * Everything a character is coloured with, derived from independent face and
 * depth materials. Environmental shadows remain a third, separate concept.
 */
export const derivePalette = (
  base: string,
  depthBase: string,
  preset: TextPresetId,
  mainStrength = 1,
  depthStrength = 1,
): TextPalette => {
  const faceAmount = clamp(mainStrength);
  const depthAmount = clamp(depthStrength);
  // Strength is a colour treatment, never opacity or geometry. At the low
  // end the chosen hue stays recognisable but becomes a light, delicate tint;
  // the high end remains the existing vivid material.
  const faceSource = blend(base, "#ffffff", (1 - faceAmount) * 0.58);
  const depthSource = blend(depthBase, "#ffffff", (1 - depthAmount) * 0.62);
  // Main-colour swatches are already tuned at full chroma. Preserve that
  // colour on the front cap instead of diluting it through the material
  // recipe; lighting supplies the physical variation.
  const rich = saturate(
    faceSource,
    (preset === "stone" ? -0.12 : 0.34) * (0.35 + faceAmount * 0.65),
  );
  const depth = saturate(
    depthSource,
    (preset === "stone" ? -0.22 : 0.2) * (0.3 + depthAmount * 0.7),
  );
  const warm = preset === "royal3d";
  const palette: TextPalette = {
    face: rich,
    faceHighlight: shade(rich, 0.28),
    faceMid: rich,
    faceShade: shade(rich, -0.3),
    bevelHighlight: warm ? shade(depth, 0.24) : shade(depth, 0.3),
    bevelShadow: shade(depth, -0.2),
    side: shade(depth, -0.06),
    outline: shade(depth, -0.28),
    shadow: blend(shade(rich, -0.7), shade(depth, -0.75), 0.35),
    contact: blend(shade(rich, -0.84), "#000000", 0.62),
    glow: shade(rich, 0.3),
    reflection: shade(rich, 0.85),
  };

  switch (preset) {
    case "crystal":
      palette.face = shade(rich, 0.3);
      palette.faceHighlight = shade(rich, 0.82);
      palette.side = blend(depth, "#ffffff", 0.18);
      palette.glow = shade(rich, 0.55);
      break;
    case "bubble":
      palette.face = shade(rich, 0.12);
      palette.faceHighlight = shade(rich, 0.75);
      palette.side = shade(depth, -0.08);
      palette.shadow = blend(shade(rich, -0.45), "#120c1a", 0.35);
      break;
    case "stone":
      palette.face = rich;
      palette.faceHighlight = shade(rich, 0.22);
      palette.faceShade = shade(rich, -0.28);
      palette.side = blend(shade(depth, -0.22), "#1a1410", 0.18);
      palette.glow = palette.faceHighlight;
      break;
    case "neon":
      palette.face = blend(shade(rich, -0.55), "#0a0c14", 0.45);
      palette.faceHighlight = shade(rich, 0.65);
      palette.side = shade(depth, -0.28);
      palette.outline = shade(depth, 0.28);
      palette.glow = shade(rich, 0.45);
      break;
    default:
      break;
  }
  return palette;
};

/* ------------------------------------------------------------- resolved style */

export interface ResolvedTextStyle extends TextPalette {
  preset: TextPresetId;
  /** Extrusion, as a fraction of font size. */
  extrude: number;
  /** Bevel lip, as a fraction of font size. */
  bevel: number;
  /** Depth passes used to build the body. */
  slices: number;
  /** Extra weight added to the letterform, in em. */
  weight: number;
  /** Edge softness, 0 crisp .. 1 soft. */
  softness: number;
  /** Outline thickness in em (0 = none). */
  outlineWidth: number;
  /** Face opacity — below 1 the object reads as translucent. */
  faceOpacity: number;
  /** Strength of the top/bevel highlight. */
  highlight: number;
  /** Cast shadow. */
  shadowOpacity: number;
  shadowBlur: number;
  shadowOffset: [number, number];
  /** Grounding shadow directly under the object. */
  contactOpacity: number;
  /** Outer glow. */
  glowOpacity: number;
  glowRadius: number;
  /** Gloss streak across the face. */
  gloss: number;
  /** True when the letters are cut into the material instead of standing on it. */
  sunk: boolean;
}

type Base = Omit<ResolvedTextStyle, keyof TextPalette | "preset">;

const BASES: Record<TextPresetId, Base> = {
  royal3d: {
    extrude: 0.23,
    bevel: 0.032,
    slices: 8,
    weight: 0.012,
    softness: 0.12,
    outlineWidth: 0.02,
    faceOpacity: 1,
    highlight: 1,
    shadowOpacity: 0.42,
    shadowBlur: 0.08,
    shadowOffset: [0.045, -0.055],
    contactOpacity: 0.35,
    glowOpacity: 0.1,
    glowRadius: 0.1,
    gloss: 0.55,
    sunk: false,
  },
  crystal: {
    extrude: 0.17,
    bevel: 0.055,
    slices: 9,
    weight: 0.004,
    softness: 0.3,
    outlineWidth: 0.014,
    faceOpacity: 0.72,
    highlight: 1.35,
    shadowOpacity: 0.26,
    shadowBlur: 0.12,
    shadowOffset: [0.03, -0.04],
    contactOpacity: 0.2,
    glowOpacity: 0.34,
    glowRadius: 0.16,
    gloss: 0.8,
    sunk: false,
  },
  bubble: {
    extrude: 0.13,
    bevel: 0.09,
    slices: 7,
    weight: 0.05,
    softness: 0.75,
    outlineWidth: 0.03,
    faceOpacity: 1,
    highlight: 1.2,
    shadowOpacity: 0.34,
    shadowBlur: 0.14,
    shadowOffset: [0.03, -0.06],
    contactOpacity: 0.3,
    glowOpacity: 0.06,
    glowRadius: 0.08,
    gloss: 0.9,
    sunk: false,
  },
  stone: {
    extrude: 0.1,
    bevel: 0.04,
    slices: 6,
    weight: 0,
    softness: 0.08,
    outlineWidth: 0,
    faceOpacity: 1,
    highlight: 0.7,
    shadowOpacity: 0.55,
    shadowBlur: 0.05,
    shadowOffset: [0.02, -0.025],
    contactOpacity: 0.5,
    glowOpacity: 0,
    glowRadius: 0,
    gloss: 0.1,
    sunk: true,
  },
  neon: {
    extrude: 0.12,
    bevel: 0.03,
    slices: 6,
    weight: 0.008,
    softness: 0.2,
    outlineWidth: 0.026,
    faceOpacity: 1,
    highlight: 1.1,
    shadowOpacity: 0.2,
    shadowBlur: 0.16,
    shadowOffset: [0.02, -0.03],
    contactOpacity: 0.16,
    glowOpacity: 0.7,
    glowRadius: 0.24,
    gloss: 0.3,
    sunk: false,
  },
};

export const presetOf = (t: TextSettings): TextPresetId => {
  const id = t.preset;
  return id && id in BASES ? id : "royal3d";
};

/** The colour the whole object is built from. */
export const baseColourOf = (t: TextSettings) =>
  t.colour ?? t.baseColour ?? PRESET_COLOURS[0]!.value;

export const depthColourOf = (t: TextSettings) =>
  t.depthColour ?? PRESET_COLOURS[3]!.value;

/**
 * preset -> palette -> the teacher's simple controls -> advanced overrides.
 * This is the single source of truth for both the slate and the preview.
 */
export const resolveTextStyle = (surface: SurfaceDef, t: TextSettings): ResolvedTextStyle => {
  const preset = presetOf(t);
  const base = BASES[preset];
  const palette = derivePalette(
    baseColourOf(t),
    depthColourOf(t),
    preset,
    t.mainTextColourStrength ?? 1,
    t.depthColourStrength ?? 1,
  );

  const depth = Math.max(0.05, t.depth);
  const contrast = Math.max(0.2, t.contrast);

  let resolved: ResolvedTextStyle = {
    preset,
    ...palette,
    ...base,
    extrude: base.extrude * depth,
    bevel: base.bevel * Math.max(0.1, t.bevel),
    highlight: base.highlight * Math.max(0, t.highlight),
    shadowOpacity: t.shadow ? base.shadowOpacity * Math.max(0, t.shadowStrength) : 0,
    contactOpacity: t.shadow ? base.contactOpacity * Math.max(0, t.shadowStrength) : 0,
    glowOpacity:
      t.glow === "off"
        ? 0
        : base.glowOpacity *
          (t.glow === "medium" ? 1.5 : 1) *
          Math.max(0, t.glowIntensity),
    faceShade: blend(palette.faceShade, palette.face, clamp(1 - contrast, 0, 0.6)),
    sunk: base.sunk,
  };

  // the material still has a say: a glassy surface reflects more, stone less
  if (surface.id === "glass" || surface.id === "ice") {
    resolved.highlight *= 1.15;
    resolved.gloss = Math.min(1, resolved.gloss + 0.15);
  }

  if (t.advanced) resolved = { ...resolved, ...t.advanced };
  return resolved;
};
