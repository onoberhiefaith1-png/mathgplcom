// Softened classroom ink palette — never pure RGB.
// Each color comes in a whiteboard variant (marker) and a blackboard variant (chalk).

export type InkColorId =
  | "slate"
  | "red"
  | "blue"
  | "green"
  | "amber"
  | "violet";

export interface InkColor {
  id: InkColorId;
  label: string;
  whiteboard: string; // marker hex
  blackboard: string; // chalk hex
}

export const INK_COLORS: Record<InkColorId, InkColor> = {
  slate:  { id: "slate",  label: "Slate",  whiteboard: "#1a2230", blackboard: "#eef1ec" },
  red:    { id: "red",    label: "Red",    whiteboard: "#b03a3a", blackboard: "#e89c9c" },
  blue:   { id: "blue",   label: "Blue",   whiteboard: "#1f4f8a", blackboard: "#9ac4e8" },
  green:  { id: "green",  label: "Green",  whiteboard: "#2b6a3a", blackboard: "#a6dca0" },
  amber:  { id: "amber",  label: "Amber",  whiteboard: "#8a6a1f", blackboard: "#e8c98a" },
  violet: { id: "violet", label: "Violet", whiteboard: "#5a3a8a", blackboard: "#c8b3e8" },
};

export const COLOR_LIST: InkColor[] = Object.values(INK_COLORS);

export const DEFAULT_INK_COLOR: InkColorId = "slate";
export const INK_COLOR_STORAGE_KEY = "smartboard:ink-color";

export const resolveInk = (id: InkColorId, surface: "whiteboard" | "blackboard"): string =>
  INK_COLORS[id]?.[surface] ?? INK_COLORS.slate[surface];
