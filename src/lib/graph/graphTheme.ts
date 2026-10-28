// Graph colour system — strictly two colours.
//
// A graph has ONE background colour and ONE foreground "ink" colour. Axes,
// numbers, axis labels, plots, points and both grid levels are all that same
// ink; the visual hierarchy comes from opacity and line weight only, never
// from a second hue.

export type GraphThemeId =
  | "whiteCharcoal"
  | "whiteNavy"
  | "whiteBlack"
  | "whiteSlate"
  | "creamBlack"
  | "darkWhite"
  | "darkNavyWhite"
  | "darkGreyWhite";

export interface GraphTheme {
  id: GraphThemeId;
  label: string;
  bg: string;
  ink: string;
  /** true when the ink is light on a dark background. */
  dark?: boolean;
}

export const GRAPH_THEMES: GraphTheme[] = [
  { id: "whiteCharcoal", label: "White + Charcoal", bg: "#FFFFFF", ink: "#1F2937" },
  { id: "whiteNavy", label: "White + Navy", bg: "#FFFFFF", ink: "#172554" },
  { id: "whiteBlack", label: "White + Black", bg: "#FFFFFF", ink: "#111111" },
  { id: "whiteSlate", label: "White + Slate", bg: "#FFFFFF", ink: "#334155" },
  { id: "creamBlack", label: "Cream + Black", bg: "#FAFAF5", ink: "#111111" },
  { id: "darkWhite", label: "Black + White", bg: "#0F1115", ink: "#FFFFFF", dark: true },
  { id: "darkNavyWhite", label: "Navy + White", bg: "#0F172A", ink: "#FFFFFF", dark: true },
  { id: "darkGreyWhite", label: "Dark Grey + White", bg: "#18181B", ink: "#FFFFFF", dark: true },
];

export const DEFAULT_GRAPH_THEME: GraphThemeId = "whiteCharcoal";

export const getGraphTheme = (id: unknown): GraphTheme =>
  GRAPH_THEMES.find((t) => t.id === id) ?? GRAPH_THEMES[0];

/** Same ink colour at a given opacity (0–1). Accepts #rgb / #rrggbb. */
export function inkAt(ink: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const hex = ink.trim().replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return ink;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export interface GraphInk {
  bg: string;
  ink: string;
  dark: boolean;
  /** X / Y axes — strongest. */
  axis: string;
  /** Numbers and text — full strength. */
  text: string;
  /** Axis name labels (x, y). */
  label: string;
  /** 1 cm major squares. */
  majorGrid: string;
  /** Subdivisions inside a major square. */
  minorGrid: string;
  /** Faint ink wash for filled shapes. */
  wash: string;
}

/**
 * Derive every drawn colour from the theme.
 * majorAlpha / minorAlpha let the teacher tune grid strength while keeping
 * the hierarchy axes > major > minor.
 */
export function graphInk(
  themeId: unknown,
  majorAlpha?: number,
  minorAlpha?: number,
): GraphInk {
  const t = getGraphTheme(themeId);
  const major = clamp(majorAlpha ?? (t.dark ? 0.3 : 0.25), 0.05, 0.6);
  const minor = clamp(minorAlpha ?? (t.dark ? 0.14 : 0.1), 0.03, major * 0.8);
  return {
    bg: t.bg,
    ink: t.ink,
    dark: !!t.dark,
    axis: t.ink,
    text: t.ink,
    label: inkAt(t.ink, 0.85),
    majorGrid: inkAt(t.ink, major),
    minorGrid: inkAt(t.ink, minor),
    wash: inkAt(t.ink, 0.06),
  };
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));

/** Map a legacy per-part colour style onto the nearest two-colour theme. */
export function themeFromLegacy(style: unknown): GraphThemeId {
  const s = (style ?? {}) as { background?: string; axis?: string };
  const bg = (s.background ?? "").toLowerCase();
  const axis = (s.axis ?? "").toLowerCase();
  const darkBg = bg && /^#(0|1|2)/.test(bg);
  if (darkBg) return "darkWhite";
  if (axis.includes("1725")) return "whiteNavy";
  return DEFAULT_GRAPH_THEME;
}
