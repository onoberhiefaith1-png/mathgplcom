// Ten notebook color themes used by the bookshelf. Index cycles modulo length.
export interface NotebookTheme {
  name: string;
  // Cover gradient (CSS background image)
  gradient: string;
  // Border/edge tint
  edge: string;
  // Foreground text on the cover
  ink: string;
  // Accent color used for the title underline + corner badge
  accent: string;
}

export const NOTEBOOK_THEMES: NotebookTheme[] = [
  { name: "blue",   gradient: "linear-gradient(160deg,#1f3a8a 0%,#1e2f6b 60%,#152252 100%)", edge: "#0d1a3d", ink: "#f4f6ff", accent: "#7aa2ff" },
  { name: "green",  gradient: "linear-gradient(160deg,#1f6b4a 0%,#155138 60%,#0d3b27 100%)", edge: "#072a1c", ink: "#eef9f1", accent: "#7ddca6" },
  { name: "orange", gradient: "linear-gradient(160deg,#b8541d 0%,#933d12 60%,#6b2a08 100%)", edge: "#3f1700", ink: "#fff3e8", accent: "#ffb27a" },
  { name: "red",    gradient: "linear-gradient(160deg,#8a1f25 0%,#6b1419 60%,#48090d 100%)", edge: "#2c0306", ink: "#fff0f1", accent: "#ff8a92" },
  { name: "purple", gradient: "linear-gradient(160deg,#4b2a7a 0%,#3a2060 60%,#27154a 100%)", edge: "#160b30", ink: "#f4eeff", accent: "#b59aff" },
  { name: "brown",  gradient: "linear-gradient(160deg,#5a3d24 0%,#432c19 60%,#2c1d10 100%)", edge: "#1a1006", ink: "#fbf2e6", accent: "#d9b489" },
  { name: "teal",   gradient: "linear-gradient(160deg,#0f5a66 0%,#0a444d 60%,#062e35 100%)", edge: "#021a1f", ink: "#eaf9fb", accent: "#7ed7e3" },
  { name: "black",  gradient: "linear-gradient(160deg,#1a1a1d 0%,#101012 60%,#050506 100%)", edge: "#000000", ink: "#f2f2f4", accent: "#c9a84c" },
  { name: "grey",   gradient: "linear-gradient(160deg,#5a5e66 0%,#43464d 60%,#2c2f35 100%)", edge: "#1a1c20", ink: "#f5f6f8", accent: "#a8b0bd" },
  { name: "cream",  gradient: "linear-gradient(160deg,#efe6d0 0%,#e2d4b3 60%,#cebf95 100%)", edge: "#7d6c47", ink: "#3a2f1c", accent: "#9a7a3c" },
];

export const themeForIndex = (i: number): NotebookTheme =>
  NOTEBOOK_THEMES[((i % NOTEBOOK_THEMES.length) + NOTEBOOK_THEMES.length) % NOTEBOOK_THEMES.length];
