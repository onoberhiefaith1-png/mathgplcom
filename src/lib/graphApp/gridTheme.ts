/** Optional look for the Math Lab 2D grid. "default" is the current Math Lab appearance. */

export type GridTheme = {
  id: "default" | "paper";
  background: string;
  minor: string;
  major: string;
  minorWidth: number;
  majorWidth: number;
  axis: string;
  label: string;
};

/** Current Math Lab look — do not change these values, or /math-lab will look different. */
export const DEFAULT_GRID_THEME: GridTheme = {
  id: "default",
  background: "#ffffff",
  minor: "rgba(15,23,42,0.06)",
  major: "rgba(15,23,42,0.16)",
  minorWidth: 1,
  majorWidth: 1,
  axis: "#0f172a",
  label: "#334155",
};

/** Light-blue centimetre-paper look for Graph Activity (stronger majors, fainter minors). */
export const PAPER_GRID_THEME_LIGHT: GridTheme = {
  id: "paper",
  background: "#f3f8fd",
  minor: "rgba(148,196,232,0.45)",
  major: "rgba(80,148,206,0.9)",
  minorWidth: 0.7,
  majorWidth: 1.35,
  axis: "#1e293b",
  label: "#334155",
};

export const PAPER_GRID_THEME_DARK: GridTheme = {
  id: "paper",
  background: "#0f1a28",
  minor: "rgba(90,150,200,0.22)",
  major: "rgba(130,186,230,0.55)",
  minorWidth: 0.7,
  majorWidth: 1.35,
  axis: "#e2e8f0",
  label: "#cbd5e1",
};

export type GridThemeName = "default" | "paper";

export function resolveGridTheme(theme: GridThemeName | GridTheme | undefined, dark = false): GridTheme {
  if (theme && typeof theme === "object") return theme;
  if (theme === "paper") return dark ? PAPER_GRID_THEME_DARK : PAPER_GRID_THEME_LIGHT;
  return DEFAULT_GRID_THEME;
}
