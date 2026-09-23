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
 * Placement is READ from this record. It is never re-derived from whatever
 * the renderer happened to measure first, and a runtime correction can never
 * overwrite it.
 */

import type { TextAlign, TextSettings, GameTextViewport } from "./text3d";
import { defaultTextSettings, responsiveTextSize } from "./text3d";

export interface SlotTextConfig {
  /** Anchor across the inner writing box (0 = left edge, 1 = right edge). */
  ax: number;
  /** Anchor down the inner writing box (0 = top edge, 1 = bottom edge). */
  ay: number;
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
}

const clamp = (value: unknown, low: number, high: number, fallback: number) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(high, Math.max(low, n));
};

const ALIGNS: TextAlign[] = ["left", "center", "right"];

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
    ax: clamp(saved.ax, 0, 1, alignAnchor(align)),
    ay: clamp(saved.ay, 0, 1, base.ay),
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
  align: config.align,
  colour: config.colour,
  lineSpacing: config.lineSpacing,
  letterSpacing: config.letterSpacing,
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

/** True when two saved records describe the same text placement and look. */
export const sameTextConfig = (a: SlotTextConfig, b: SlotTextConfig) =>
  (Object.keys(a) as (keyof SlotTextConfig)[]).every((key) => a[key] === b[key]);

/** Also exported for the responsive fallback used by legacy games. */
export const legacyResponsiveSize = responsiveTextSize;
