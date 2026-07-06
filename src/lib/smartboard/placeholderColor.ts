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
