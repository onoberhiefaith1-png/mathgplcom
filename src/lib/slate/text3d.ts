// Live 3D mathematical text: style registry and per-material recipes.
//
// Nothing here knows about mathematics semantics. It only describes how a
// string should be physically inscribed into a given material.

import type { SurfaceDef } from "./surfaces";
import type { ResolvedTextStyle, TextPresetId } from "./textPresets";

export type TextStyleId =
  | "inscription"
  | "hero"
  | "crystal"
  | "handwritten"
  | "runic"
  | "technical"
  | "chalk"
  | "royal"
  | "mechanical"
  | "glow"
  | "tiles"
  | "dimensional";

/** Character treatments offered by the 3D Mathematical Text style. */
export type DimensionalSubstyle =
  | "classic"
  | "bold"
  | "rounded"
  | "soft"
  | "heavy"
  | "inscribed";
export type TextRelief = "engraved" | "carved" | "embossed" | "raised";
export type GlowLevel = "off" | "subtle" | "medium";
export type TextAlign = "left" | "center" | "right";

export type Integration = "low" | "medium" | "high";

export interface TextSettings {
  /** A / B / C visual identity. */
  style: TextStyleId;
  /** Nominal size in CSS px (converted to world units by the renderer). */
  size: number;
  /** Apparent extrusion / recess depth. */
  depth: number;
  /** Edge softness of the bevel lip. */
  bevel: number;
  relief: TextRelief;
  /** How strongly the letters separate from the material. */
  contrast: number;
  shadow: boolean;
  shadowStrength: number;
  highlight: number;
  glow: GlowLevel;
  /** Continuous multiplier on top of the glow level. */
  glowIntensity: number;
  align: TextAlign;
  lineSpacing: number;
  letterSpacing: number;
  /** Overrides the material's own ink colour when set. */
  colour: string | null;
  /** Visibility of the inscription itself. */
  opacity: number;
  /** How strongly the letters read as cut into the material. */
  integration: Integration;
  /** Colours the user saved from the picker. Older drafts may omit this. */
  swatches?: string[];
  /** Character treatment, used by the 3D Mathematical Text style only. */
  substyle?: DimensionalSubstyle;
  /** Premium visual treatment. Older drafts fall back to Royal 3D. */
  preset?: TextPresetId;
  /** The colour the whole object is derived from. */
  baseColour?: string;
  /** High-level strength of the front-face colour, from delicate to vivid. */
  mainTextColourStrength?: number;
  /** Independent physical colour of the bevel and extruded sides. */
  depthColour?: string;
  /** High-level strength of the physical depth colour, from subtle to rich. */
  depthColourStrength?: number;
  /** Slow whole-expression motion that reveals the physical depth. */
  animate?: boolean;
  /** Advanced Living 3D controls. */
  livingAngle?: number;
  livingDrift?: number;
  livingLift?: number;
  livingScale?: number;
  livingDuration?: number;
  /** Explicit overrides made in Advanced, on top of the preset. */
  advanced?: Partial<ResolvedTextStyle>;
}

export const TEXT_STYLES: { id: TextStyleId; label: string; blurb: string }[] = [
  { id: "inscription", label: "A — Ancient Inscription", blurb: "Carved, physical, ancient" },
  { id: "hero", label: "B — Hero Game Text", blurb: "Bold, dimensional, game-like" },
  { id: "crystal", label: "C — Magic / Crystal Text", blurb: "Luminous, magical, dimensional" },
  { id: "handwritten", label: "D — Handwritten", blurb: "Written by hand on the surface" },
  { id: "runic", label: "E — Runic / Ancient", blurb: "Ancient symbols, still readable" },
  { id: "technical", label: "F — Technical", blurb: "Clean mathematical engraving" },
  { id: "chalk", label: "G — Chalk / Marker", blurb: "Classroom chalk on the material" },
  { id: "royal", label: "H — Royal / Adventure", blurb: "Premium fantasy lettering" },
  { id: "mechanical", label: "I — Mechanical / Engraved", blurb: "Precise industrial engraving" },
  { id: "glow", label: "J — Crystal Glow", blurb: "Bright dimensional glow" },
  {
    id: "tiles",
    label: "K — Mathematical Game Tiles",
    blurb: "Every character a physical game tile",
  },
  {
    id: "dimensional",
    label: "L — 3D Mathematical Text",
    blurb: "True extruded characters, one colour",
  },
];

export const FONTS: Record<TextStyleId, string> = {
  inscription: "/fonts/inscription.ttf",
  hero: "/fonts/hero.ttf",
  crystal: "/fonts/crystal.ttf",
  handwritten: "/fonts/handwritten.ttf",
  runic: "/fonts/runic.ttf",
  technical: "/fonts/technical.ttf",
  chalk: "/fonts/chalk.ttf",
  royal: "/fonts/royal.ttf",
  mechanical: "/fonts/mechanical.ttf",
  glow: "/fonts/glow.ttf",
  tiles: "/fonts/hero.ttf",
  dimensional: "/fonts/hero.ttf",
};

/** Per-substyle character treatment for the 3D Mathematical Text style. */
export const DIMENSIONAL_SUBSTYLES: {
  id: DimensionalSubstyle;
  label: string;
  /** Extrusion multiplier. */
  extrude: number;
  /** Bevel lip multiplier. */
  bevel: number;
  /** Edge softness (0 = crisp, 1 = soft). */
  softness: number;
  /** Weight added to the face, as an outline in em. */
  weight: number;
  font: string;
}[] = [
  { id: "classic", label: "3D Classic", extrude: 1, bevel: 1, softness: 0.2, weight: 0, font: "/fonts/hero.ttf" },
  { id: "bold", label: "3D Bold", extrude: 1.25, bevel: 1.1, softness: 0.15, weight: 0.035, font: "/fonts/hero.ttf" },
  { id: "rounded", label: "3D Rounded", extrude: 1.05, bevel: 1.4, softness: 0.55, weight: 0.02, font: "/fonts/royal.ttf" },
  { id: "soft", label: "3D Soft", extrude: 0.8, bevel: 1.2, softness: 0.85, weight: 0.012, font: "/fonts/royal.ttf" },
  { id: "heavy", label: "3D Heavy", extrude: 1.7, bevel: 1.25, softness: 0.1, weight: 0.055, font: "/fonts/hero.ttf" },
  { id: "inscribed", label: "3D Inscribed", extrude: 1.15, bevel: 0.8, softness: 0.05, weight: 0, font: "/fonts/inscription.ttf" },
];

export const getSubstyle = (id: DimensionalSubstyle | undefined) =>
  DIMENSIONAL_SUBSTYLES.find((s) => s.id === id) ?? DIMENSIONAL_SUBSTYLES[0]!;

/** What kind of mathematical object a character is — drives tile identity. */
export type GlyphClass =
  | "digit"
  | "variable"
  | "operator"
  | "relation"
  | "root"
  | "bracket"
  | "other";

const OPERATORS = "+-−×÷·±*/";
const RELATIONS = "=≠<>≤≥≈≡∝";
const ROOTS = "√∛∜∫∂∇∑∏Σ";
const BRACKETS = "()[]{}|";

export const classifyGlyph = (ch: string): GlyphClass => {
  if (/[0-9.,]/.test(ch)) return "digit";
  if (OPERATORS.includes(ch)) return "operator";
  if (RELATIONS.includes(ch)) return "relation";
  if (ROOTS.includes(ch)) return "root";
  if (BRACKETS.includes(ch)) return "bracket";
  if (/[A-Za-zα-ωΑ-Ω]/.test(ch)) return "variable";
  return "other";
};

/** One controlled game palette: each object type has its own tile identity. */
export const TILE_PALETTE: Record<GlyphClass, { face: string; edge: string; symbol: string }> = {
  digit: { face: "#2f7fd6", edge: "#1a4f8c", symbol: "#f4fbff" },
  variable: { face: "#d9483f", edge: "#8e2a24", symbol: "#fff2ef" },
  operator: { face: "#e5a021", edge: "#9a6408", symbol: "#3a2402" },
  relation: { face: "#3fa564", edge: "#22643b", symbol: "#f2fff6" },
  root: { face: "#7d55c7", edge: "#4a2e80", symbol: "#f6f0ff" },
  bracket: { face: "#c9803a", edge: "#7d4a18", symbol: "#fff5e8" },
  other: { face: "#5c6b7a", edge: "#2f3a45", symbol: "#eef4f9" },
};

export const RELIEFS: TextRelief[] = ["engraved", "carved", "embossed", "raised"];

export const defaultTextSettings = (): TextSettings => ({
  style: "inscription",
  size: 30,
  depth: 1,
  bevel: 1,
  relief: "engraved",
  contrast: 1,
  shadow: true,
  shadowStrength: 1,
  highlight: 1,
  glow: "subtle",
  glowIntensity: 1,
  align: "left",
  lineSpacing: 1.45,
  letterSpacing: 0.01,
  colour: null,
  opacity: 1,
  integration: "medium",
  substyle: "classic",
  swatches: [],
  preset: "royal3d",
  baseColour: "#2f7fd6",
  mainTextColourStrength: 1,
  depthColour: "#e5a021",
  depthColourStrength: 1,
  animate: false,
  livingAngle: 4,
  livingDrift: 0.012,
  livingLift: 0.008,
  livingScale: 0.008,
  livingDuration: 7.5,
});

/** Preset inks that sit convincingly on the ten materials. */
export const TEXT_COLOURS: { label: string; value: string }[] = [
  { label: "Material default", value: "" },
  { label: "Bone", value: "#efe3c8" },
  { label: "Gold", value: "#e8bf6a" },
  { label: "Ember", value: "#e2762f" },
  { label: "Ink", value: "#241708" },
  { label: "Frost", value: "#d8f2ff" },
  { label: "Verdant", value: "#9fd58a" },
  { label: "Arcane", value: "#b79cff" },
];

export const INTEGRATIONS: Integration[] = ["low", "medium", "high"];

export const integrationFactor = (i: Integration) =>
  i === "low" ? 0.55 : i === "high" ? 1.55 : 1;

export interface TextRecipe {
  font: string;
  /** Body colour of the letterforms. */
  ink: string;
  /** Colour sunk into the carved interior. */
  shade: string;
  /** Colour of the lit lip of the cut. */
  lip: string;
  glow: string | null;
  glowOpacity: number;
  roughness: number;
  metalness: number;
  emissive: string;
  emissiveIntensity: number;
  /** True when the letters sit inside the material rather than on top of it. */
  sunk: boolean;
  /** How many stacked passes simulate the cut depth. */
  layers: number;
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Darkens (amount < 0) or lightens (amount > 0) a hex colour. */
const shift = (hex: string, amount: number) => {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.padEnd(6, "0").slice(0, 6);
  const channel = (i: number) => {
    const v = parseInt(full.slice(i * 2, i * 2 + 2), 16);
    const next = amount >= 0 ? mix(v, 255, amount) : mix(v, 0, -amount);
    return Math.round(Math.max(0, Math.min(255, next)))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(1)}${channel(2)}`;
};

/** Per-material overrides on top of the chosen style. */
const materialTone = (
  surfaceId: string,
): { ink?: string; shade?: string; lip?: string; roughness: number; metalness: number } => {
  switch (surfaceId) {
    case "stone-wall":
    case "stone-tablet":
      return { shade: "#0a0705", lip: "#f0dcb4", roughness: 0.92, metalness: 0 };
    case "wood":
    case "door":
    case "chest":
      return { shade: "#190d03", lip: "#ffdda6", roughness: 0.78, metalness: 0 };
    case "metal-plate":
    case "shield":
      return { shade: "#05070a", lip: "#ffffff", roughness: 0.32, metalness: 0.85 };
    case "scroll":
      return { ink: "#2b1a0c", shade: "#4a2f16", lip: "#fff7e6", roughness: 0.95, metalness: 0 };
    case "glass":
      return { ink: "#f2fdff", shade: "#04222f", lip: "#ffffff", roughness: 0.12, metalness: 0.1 };
    case "ice":
      return { ink: "#eefaff", shade: "#06263f", lip: "#ffffff", roughness: 0.2, metalness: 0.05 };
    default:
      return { roughness: 0.8, metalness: 0 };
  }
};

/** Resolves the full physical treatment for one surface + settings pair. */
export const textRecipe = (surface: SurfaceDef, t: TextSettings): TextRecipe => {
  const tone = materialTone(surface.id);
  const sunk = t.relief === "engraved" || t.relief === "carved";
  const base: TextRecipe = {
    font: FONTS[t.style],
    ink: tone.ink ?? surface.ink,
    shade: tone.shade ?? surface.inkShadow,
    lip: tone.lip ?? surface.inkHighlight,
    glow: null,
    glowOpacity: 0,
    roughness: tone.roughness,
    metalness: tone.metalness,
    emissive: "#000000",
    emissiveIntensity: 0,
    sunk,
    layers: Math.max(1, Math.round(mix(1, 5, Math.min(1, t.depth / 2)))),
  };

  // a chosen ink still has to behave like a cut: shade sinks, lip catches light
  const chosen = t.colour ?? t.baseColour ?? null;
  if (chosen) {
    base.ink = chosen;
    const depth = t.depthColour ?? chosen;
    base.shade = shift(depth, -0.35);
    base.lip = shift(depth, 0.42);
  }

  // Each style reacts to light differently, so switching identity is visible
  // even on the same material.
  switch (t.style) {
    case "hero":
      base.roughness = Math.max(0.18, tone.roughness * 0.55);
      base.emissive = base.ink;
      base.emissiveIntensity = 0.12 * t.contrast;
      base.layers = Math.max(base.layers, 3);
      break;
    case "crystal":
      base.roughness = 0.16;
      base.metalness = 0.05;
      base.emissive = base.ink;
      base.emissiveIntensity = 0.45 * t.contrast;
      base.glow = base.lip;
      break;
    case "handwritten":
      base.roughness = 0.96;
      base.metalness = 0;
      base.layers = Math.max(1, base.layers - 2);
      base.shade = shift(base.ink, -0.55);
      break;
    case "runic":
      base.roughness = Math.min(1, tone.roughness + 0.06);
      base.shade = shift(base.shade, -0.25);
      base.layers = Math.max(base.layers, 4);
      break;
    case "technical":
      base.roughness = Math.max(0.25, tone.roughness * 0.7);
      base.metalness = Math.max(tone.metalness, 0.25);
      base.layers = Math.max(2, base.layers - 1);
      break;
    case "chalk":
      base.roughness = 1;
      base.metalness = 0;
      base.ink = t.colour ?? shift(base.lip, 0.35);
      base.shade = shift(base.ink, -0.45);
      base.layers = 1;
      break;
    case "royal":
      base.roughness = Math.max(0.22, tone.roughness * 0.5);
      base.metalness = Math.max(tone.metalness, 0.6);
      base.emissive = base.ink;
      base.emissiveIntensity = 0.1 * t.contrast;
      base.layers = Math.max(base.layers, 4);
      break;
    case "mechanical":
      base.roughness = 0.3;
      base.metalness = 0.9;
      base.shade = shift(base.shade, -0.3);
      base.lip = shift(base.lip, 0.2);
      base.layers = Math.max(base.layers, 3);
      break;
    case "glow":
      base.roughness = 0.12;
      base.metalness = 0.02;
      base.emissive = base.ink;
      base.emissiveIntensity = 0.75 * t.contrast;
      base.glow = base.lip;
      break;
    default:
      break;
  }

  if (t.glow !== "off") {
    base.glow = base.glow ?? base.lip;
    base.glowOpacity =
      (t.glow === "subtle" ? 0.16 : 0.34) *
      (t.style === "crystal" ? 1.4 : t.style === "glow" ? 1.9 : 1) *
      Math.max(0, t.glowIntensity);
  } else {
    base.glow = null;
    base.glowOpacity = 0;
  }

  return base;
};

/** Clean structured snapshot of one writing region, for later integrations. */
export interface RegionTextData {
  slotId: string;
  text: string;
  lines: string[];
  cursorPosition: number;
  selection: [number, number] | null;
  position: { x: number; y: number; z: number };
  width: number;
  height: number;
  material: string;
  style: TextStyleId;
}

/** Actual visible bounds reported by Troika, in local writing coordinates. */
export interface TextBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}
