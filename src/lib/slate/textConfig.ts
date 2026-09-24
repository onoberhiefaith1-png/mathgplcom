/* ── Saved Text Configuration ─────────────────────────────────────────────
 *
 * THE master record of one writing surface's text.
 *
 * Everything here is expressed in the WRITING SURFACE'S OWN coordinate
 * system — anchors and spans are fractions of that surface's inner writing
 * box, never screen, page or canvas pixels. That is what makes a saved text
 * survive a reopen, a refresh, another device, another window size and
 * another viewer: the surface is the coordinate system, so a share of the
 * surface means the same thing everywhere.
 *
 * Placement is READ from this record. A renderer may validate that placement
 * against real glyph bounds and persist the smallest required correction, but
 * no independent screen-coordinate position is allowed to overwrite it.
 */

import type {
  DimensionalSubstyle,
  GlowLevel,
  Integration,
  TextAlign,
  TextRelief,
  TextSettings,
  GameTextViewport,
} from "./text3d";
import {
  DIMENSIONAL_SUBSTYLES,
  INTEGRATIONS,
  RELIEFS,
  TEXT_STYLES,
  defaultTextSettings,
  responsiveTextSize,
} from "./text3d";
import { containTextInSurface, textInsideSurface, type TextBox } from "./layout";
import type { ResolvedTextStyle, TextPresetId } from "./textPresets";
import { TEXT_PRESETS } from "./textPresets";

export interface SlotTextConfig {
  /**
   * Legacy anchor across the inner writing box. It is no longer a position:
   * the Content Margin decides where every line starts, so this is kept only
   * so older saved records stay readable.
   */
  ax: number;
  /** Anchor down the inner writing box (0 = top edge, 1 = bottom edge). */
  ay: number;
  /**
   * Deliberate extra indentation from the margin, as a share of the content
   * width. Never negative: no line may sit left of the margin.
   */
  indent: number;
  /** Share of the inner box the body may occupy. */
  widthFrac: number;
  heightFrac: number;

  /** The teacher's saved letter size per device. */
  desktopSize: number;
  tabletSize: number;
  mobileSize: number;
  align: TextAlign;
  /** Degrees, around the surface's own centre. */
  rotation: number;
  colour: string | null;
  lineSpacing: number;
  letterSpacing: number;
  /** Complete visible style owned by this saved surface text. */
  style: TextSettings["style"];
  depth: number;
  bevel: number;
  relief: TextRelief;
  contrast: number;
  shadow: boolean;
  shadowStrength: number;
  highlight: number;
  glow: GlowLevel;
  glowIntensity: number;
  opacity: number;
  integration: Integration;
  substyle: DimensionalSubstyle;
  preset: TextPresetId;
  baseColour: string;
  mainTextColourStrength: number;
  depthColour: string;
  depthColourStrength: number;
  animate: boolean;
  livingAngle: number;
  livingDrift: number;
  livingLift: number;
  livingScale: number;
  livingDuration: number;
  advanced?: Partial<ResolvedTextStyle>;
}

const clamp = (value: unknown, low: number, high: number, fallback: number) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(high, Math.max(low, n));
};

const ALIGNS: TextAlign[] = ["left", "center", "right"];
const GLOWS: GlowLevel[] = ["off", "subtle", "medium"];
const validStyle = (value: unknown, fallback: TextSettings["style"]) =>
  TEXT_STYLES.some((item) => item.id === value) ? value as TextSettings["style"] : fallback;
const validRelief = (value: unknown, fallback: TextRelief) =>
  (RELIEFS as readonly string[]).includes(String(value)) ? value as TextRelief : fallback;
const validIntegration = (value: unknown, fallback: Integration) =>
  (INTEGRATIONS as readonly string[]).includes(String(value)) ? value as Integration : fallback;
const validGlow = (value: unknown, fallback: GlowLevel) =>
  GLOWS.includes(value as GlowLevel) ? value as GlowLevel : fallback;
const validSubstyle = (value: unknown, fallback: DimensionalSubstyle) =>
  DIMENSIONAL_SUBSTYLES.some((item) => item.id === value) ? value as DimensionalSubstyle : fallback;
const validPreset = (value: unknown, fallback: TextPresetId) =>
  TEXT_PRESETS.some((item) => item.id === value) ? value as TextPresetId : fallback;
const colour = (value: unknown, fallback: string) => typeof value === "string" && value ? value : fallback;
const advanced = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Partial<ResolvedTextStyle>
    : undefined;

/** Where the chosen alignment naturally places the body inside its surface. */
export const alignAnchor = (align: TextAlign) =>
  align === "left" ? 0 : align === "right" ? 1 : 0.5;

/** The master record a text starts from, taken from the Game's text settings. */
export const defaultTextConfig = (settings?: TextSettings): SlotTextConfig => {
  const base = { ...defaultTextSettings(), ...(settings ?? {}) };
  const size = clamp(base.size, 4, 400, 30);
  return {
    ax: alignAnchor(base.align),
    ay: 0,
    indent: 0,

    widthFrac: 1,
    heightFrac: 1,
    desktopSize: clamp(base.desktopSize, 4, 400, size),
    tabletSize: clamp(base.tabletSize, 4, 400, size),
    mobileSize: clamp(base.mobileSize, 4, 400, size),
    align: base.align,
    rotation: 0,
    colour: base.colour ?? null,
    lineSpacing: clamp(base.lineSpacing, 0.8, 3, 1.45),
    letterSpacing: clamp(base.letterSpacing, -0.2, 0.5, 0.01),
    style: base.style,
    depth: clamp(base.depth, 0, 4, 1),
    bevel: clamp(base.bevel, 0, 4, 1),
    relief: base.relief,
    contrast: clamp(base.contrast, 0.1, 4, 1),
    shadow: Boolean(base.shadow),
    shadowStrength: clamp(base.shadowStrength, 0, 4, 1),
    highlight: clamp(base.highlight, 0, 4, 1),
    glow: base.glow,
    glowIntensity: clamp(base.glowIntensity, 0, 4, 1),
    opacity: clamp(base.opacity, 0, 1, 1),
    integration: base.integration,
    substyle: base.substyle ?? "classic",
    preset: base.preset ?? "royal3d",
    baseColour: colour(base.baseColour, "#2f7fd6"),
    mainTextColourStrength: clamp(base.mainTextColourStrength, 0, 1, 1),
    depthColour: colour(base.depthColour, "#e5a021"),
    depthColourStrength: clamp(base.depthColourStrength, 0, 1, 1),
    animate: Boolean(base.animate),
    livingAngle: clamp(base.livingAngle, 0, 20, 4),
    livingDrift: clamp(base.livingDrift, 0, 0.2, 0.012),
    livingLift: clamp(base.livingLift, 0, 0.2, 0.008),
    livingScale: clamp(base.livingScale, 0, 0.2, 0.008),
    livingDuration: clamp(base.livingDuration, 1, 60, 7.5),
    ...(base.advanced ? { advanced: base.advanced } : {}),
  };
};

/** Fills in anything an older saved text is missing. Never drops teacher work. */
export const normalizeTextConfig = (
  saved: Partial<SlotTextConfig> | null | undefined,
  settings?: TextSettings,
): SlotTextConfig => {
  const base = defaultTextConfig(settings);
  if (!saved || typeof saved !== "object") return base;
  const align = ALIGNS.includes(saved.align as TextAlign) ? (saved.align as TextAlign) : base.align;
  return {
    // THE MARGIN IS THE START. Legacy sideways nudging is discarded, so every
    // line snaps to the one margin; only deliberate indentation moves it right.
    ax: alignAnchor(align),
    ay: clamp(saved.ay, 0, 1, base.ay),
    indent: clamp(saved.indent, 0, 1, 0),

    widthFrac: clamp(saved.widthFrac, 0.05, 1, base.widthFrac),
    heightFrac: clamp(saved.heightFrac, 0.05, 1, base.heightFrac),
    desktopSize: clamp(saved.desktopSize, 4, 400, base.desktopSize),
    tabletSize: clamp(saved.tabletSize, 4, 400, base.tabletSize),
    mobileSize: clamp(saved.mobileSize, 4, 400, base.mobileSize),
    align,
    rotation: clamp(saved.rotation, -180, 180, base.rotation),
    colour: typeof saved.colour === "string" ? saved.colour : saved.colour === null ? null : base.colour,
    lineSpacing: clamp(saved.lineSpacing, 0.8, 3, base.lineSpacing),
    letterSpacing: clamp(saved.letterSpacing, -0.2, 0.5, base.letterSpacing),
    style: validStyle(saved.style, base.style),
    depth: clamp(saved.depth, 0, 4, base.depth),
    bevel: clamp(saved.bevel, 0, 4, base.bevel),
    relief: validRelief(saved.relief, base.relief),
    contrast: clamp(saved.contrast, 0.1, 4, base.contrast),
    shadow: typeof saved.shadow === "boolean" ? saved.shadow : base.shadow,
    shadowStrength: clamp(saved.shadowStrength, 0, 4, base.shadowStrength),
    highlight: clamp(saved.highlight, 0, 4, base.highlight),
    glow: validGlow(saved.glow, base.glow),
    glowIntensity: clamp(saved.glowIntensity, 0, 4, base.glowIntensity),
    opacity: clamp(saved.opacity, 0, 1, base.opacity),
    integration: validIntegration(saved.integration, base.integration),
    substyle: validSubstyle(saved.substyle, base.substyle),
    preset: validPreset(saved.preset, base.preset),
    baseColour: colour(saved.baseColour, base.baseColour),
    mainTextColourStrength: clamp(saved.mainTextColourStrength, 0, 1, base.mainTextColourStrength),
    depthColour: colour(saved.depthColour, base.depthColour),
    depthColourStrength: clamp(saved.depthColourStrength, 0, 1, base.depthColourStrength),
    animate: typeof saved.animate === "boolean" ? saved.animate : base.animate,
    livingAngle: clamp(saved.livingAngle, 0, 20, base.livingAngle),
    livingDrift: clamp(saved.livingDrift, 0, 0.2, base.livingDrift),
    livingLift: clamp(saved.livingLift, 0, 0.2, base.livingLift),
    livingScale: clamp(saved.livingScale, 0, 0.2, base.livingScale),
    livingDuration: clamp(saved.livingDuration, 1, 60, base.livingDuration),
    ...(advanced(saved.advanced) ? { advanced: advanced(saved.advanced) } : {}),
  };
};

/** The saved letter size for this device. */
export const configTextSize = (config: SlotTextConfig, viewport: GameTextViewport) =>
  viewport === "mobile" ? config.mobileSize : viewport === "tablet" ? config.tabletSize : config.desktopSize;

/**
 * The render settings for one surface: the Game's shared visual identity with
 * this text's own saved size, alignment, colour and spacing applied on top.
 */
export const textSettingsFromConfig = (
  settings: TextSettings,
  config: SlotTextConfig,
  viewport: GameTextViewport,
): TextSettings => ({
  ...settings,
  size: configTextSize(config, viewport),
  style: config.style,
  depth: config.depth,
  bevel: config.bevel,
  relief: config.relief,
  contrast: config.contrast,
  shadow: config.shadow,
  shadowStrength: config.shadowStrength,
  highlight: config.highlight,
  glow: config.glow,
  glowIntensity: config.glowIntensity,
  align: config.align,
  colour: config.colour,
  lineSpacing: config.lineSpacing,
  letterSpacing: config.letterSpacing,
  opacity: config.opacity,
  integration: config.integration,
  substyle: config.substyle,
  preset: config.preset,
  baseColour: config.baseColour,
  mainTextColourStrength: config.mainTextColourStrength,
  depthColour: config.depthColour,
  depthColourStrength: config.depthColourStrength,
  animate: config.animate,
  livingAngle: config.livingAngle,
  livingDrift: config.livingDrift,
  livingLift: config.livingLift,
  livingScale: config.livingScale,
  livingDuration: config.livingDuration,
  advanced: config.advanced,
});

/**
 * The saved placement, in the surface's own local units.
 *
 * Zero means "exactly where this alignment puts it", so a text that was never
 * moved renders identically to before while still being fully described by
 * its saved record.
 */
export const savedTextOffset = (
  config: SlotTextConfig,
  innerWidth: number,
  innerHeight: number,
) => ({
  x: (config.ax - alignAnchor(config.align)) * Math.max(0, innerWidth),
  y: -config.ay * Math.max(0, innerHeight),
});

/** Turns a live placement back into a surface-relative saved record. */
export const textConfigFromPlacement = (
  config: SlotTextConfig,
  offset: { x: number; y: number },
  innerWidth: number,
  innerHeight: number,
): SlotTextConfig => {
  const width = Math.max(0.0001, innerWidth);
  const height = Math.max(0.0001, innerHeight);
  return {
    ...config,
    ax: clamp(alignAnchor(config.align) + offset.x / width, 0, 1, config.ax),
    ay: clamp(-offset.y / height, 0, 1, config.ay),
  };
};

export interface SurfaceTextPlacement {
  offset: { x: number; y: number };
  config: SlotTextConfig;
  corrected: boolean;
  fits: boolean;
}

/**
 * The single keep-or-correct rule for saved Game text placement.
 *
 * `body` is the measured text box after applying `offset`, in the writing
 * surface's local coordinates. A valid saved placement is returned untouched;
 * an invalid one is moved by the smallest possible amount and translated back
 * into the same surface-relative record used by Save, Preview and Play.
 */
export const resolveSurfaceTextPlacement = ({
  config,
  offset,
  body,
  inner,
  innerWidth,
  innerHeight,
}: {
  config: SlotTextConfig;
  offset: { x: number; y: number };
  body: TextBox;
  inner: TextBox;
  innerWidth: number;
  innerHeight: number;
}): SurfaceTextPlacement => {
  if (textInsideSurface(body, inner)) {
    return { offset, config, corrected: false, fits: true };
  }
  const correction = containTextInSurface(body, inner);
  const correctedOffset = {
    x: offset.x + correction.dx,
    y: offset.y + correction.dy,
  };
  return {
    offset: correctedOffset,
    config: textConfigFromPlacement(config, correctedOffset, innerWidth, innerHeight),
    corrected: Math.abs(correction.dx) > 0.006 || Math.abs(correction.dy) > 0.006,
    fits: correction.fits,
  };
};

/** True when two saved records describe the same text placement and look. */
export const sameTextConfig = (a: SlotTextConfig, b: SlotTextConfig) =>
  (Object.keys(a) as (keyof SlotTextConfig)[]).every((key) => {
    const left = a[key];
    const right = b[key];
    if (left && typeof left === "object") return JSON.stringify(left) === JSON.stringify(right);
    return left === right;
  });

/** Also exported for the responsive fallback used by legacy games. */
export const legacyResponsiveSize = responsiveTextSize;
