import type { CSSProperties } from "react";

// Placeholder colours are independent from ink colours. Every structure rule
// must read as: "use ink/currentColor, except placeholder slots".
export const PLACEHOLDER_COLOR = "#efece5";
export const BLACKBOARD_PLACEHOLDER_COLOR = "#161c1a";

export type PlaceholderColorId =
  | "board"
  | "cream"
  | "chalk"
  | "slate"
  | "amber"
  | "blue";

export interface PlaceholderColor {
  id: PlaceholderColorId;
  label: string;
  whiteboard: string;
  blackboard: string;
}

export const PLACEHOLDER_COLORS: Record<PlaceholderColorId, PlaceholderColor> = {
  board: { id: "board", label: "Board", whiteboard: PLACEHOLDER_COLOR, blackboard: BLACKBOARD_PLACEHOLDER_COLOR },
  cream: { id: "cream", label: "Cream", whiteboard: PLACEHOLDER_COLOR, blackboard: PLACEHOLDER_COLOR },
  chalk: { id: "chalk", label: "Chalk", whiteboard: "#f6f4ef", blackboard: "#eef1ec" },
  slate: { id: "slate", label: "Slate", whiteboard: "#1a2230", blackboard: "#1a2230" },
  amber: { id: "amber", label: "Amber", whiteboard: "#8a6a1f", blackboard: "#e8c98a" },
  blue: { id: "blue", label: "Blue", whiteboard: "#1f4f8a", blackboard: "#9ac4e8" },
};

export const PLACEHOLDER_COLOR_LIST: PlaceholderColor[] = Object.values(PLACEHOLDER_COLORS);
export const DEFAULT_PLACEHOLDER_COLOR: PlaceholderColorId = "board";
export const PLACEHOLDER_COLOR_STORAGE_KEY = "smartboard:placeholder-color";

export const isPlaceholderColorId = (value: unknown): value is PlaceholderColorId =>
  typeof value === "string" && value in PLACEHOLDER_COLORS;

export const sanitizePlaceholderColorId = (value: unknown): PlaceholderColorId =>
  isPlaceholderColorId(value) ? value : DEFAULT_PLACEHOLDER_COLOR;

export const resolvePlaceholderColor = (
  id: PlaceholderColorId,
  surface: "whiteboard" | "blackboard",
): string => PLACEHOLDER_COLORS[sanitizePlaceholderColorId(id)][surface];

export type PlaceholderSlotSize = "inline" | "compact" | "panel" | "box";

const SLOT_SIZE: Record<PlaceholderSlotSize, Pick<CSSProperties, "width" | "height" | "minWidth" | "minHeight" | "padding" | "borderRadius">> = {
  inline: { minWidth: "0.78em", minHeight: "0.9em", padding: "0 0.05em", borderRadius: 3 },
  compact: { width: "0.78em", height: "0.78em", borderRadius: 2 },
  panel: { minWidth: "0.82em", minHeight: "0.82em", padding: "0 0.04em", borderRadius: 3 },
  box: { minWidth: "0.7em", minHeight: "1em", padding: "0 0.12em", borderRadius: 4 },
};

export const smartboardPlaceholderStyle = (
  color: string,
  opts: {
    size?: PlaceholderSlotSize;
    active?: boolean;
    caretColor?: string;
    cursor?: CSSProperties["cursor"];
    verticalAlign?: CSSProperties["verticalAlign"];
  } = {},
): CSSProperties => {
  const size = opts.size ?? "inline";
  return {
    ...SLOT_SIZE[size],
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    margin: "0 1px",
    border: `1.4px dashed ${color}`,
    background: color,
    color,
    opacity: 1,
    textShadow: "none",
    filter: "none",
    WebkitFilter: "none",
    mixBlendMode: "normal",
    isolation: "isolate",
    boxShadow: opts.active && opts.caretColor ? `0 0 0 1px ${opts.caretColor}55, 0 0 6px ${opts.caretColor}55` : "none",
    cursor: opts.cursor ?? "text",
    verticalAlign: opts.verticalAlign ?? "baseline",
    touchAction: "manipulation",
    transition: "background 120ms, border-color 120ms, box-shadow 120ms",
  };
};

/* ── contrast guard ────────────────────────────────────────────────────
 * Placeholder slots are painted with the BOARD's placeholder colour, which
 * is deliberately near-white (cream) so empty cells read as "chalk paper"
 * on a dark/whiteboard surface. The Floating Number Display, however, is a
 * WHITE chip bar: a cream slot on white is invisible, which made every
 * placeholder (√□, □^□, the fraction cells…) look like it had been deleted.
 * Any light surface must therefore fall back to a visible grey slot. */

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Relative luminance (0 = black, 1 = white) of a hex colour. */
export const colorLuminance = (color: string): number => {
  const m = HEX.exec(String(color ?? "").trim());
  if (!m) return 0.5;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const n = parseInt(hex, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Neutral slot colour used when the board placeholder colour would vanish. */
export const LIGHT_SURFACE_PLACEHOLDER_COLOR = "#9aa3af";
export const DARK_SURFACE_PLACEHOLDER_COLOR = "#e8e4dc";

/**
 * Resolve a placeholder colour that is guaranteed to stay VISIBLE on the
 * given surface. Never returns "invisible" — the slot must always be seen,
 * because an empty slot is real mathematical information.
 */
export const visiblePlaceholderColor = (
  color: string | undefined,
  surfaceColor: string,
): string => {
  const surface = colorLuminance(surfaceColor);
  const slot = colorLuminance(color ?? PLACEHOLDER_COLOR);
  if (Math.abs(slot - surface) >= 0.18) return color ?? PLACEHOLDER_COLOR;
  return surface > 0.5 ? LIGHT_SURFACE_PLACEHOLDER_COLOR : DARK_SURFACE_PLACEHOLDER_COLOR;
};
