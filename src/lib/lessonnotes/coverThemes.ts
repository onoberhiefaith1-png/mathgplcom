// Notebook cover design: 10 AI-suggested themes + fully editable cover text.
//
// Everything drawn on a cover comes from `NotebookCoverConfig`, so a teacher can
// replace every single word ("MATH GPL NOTEBOOK" → "Year 9 Algebra") and swap the
// visual theme independently. An AI-generated artwork can also sit behind the text.

export type CoverPattern =
  | "none"
  | "grid"
  | "blueprint"
  | "geometry"
  | "dots"
  | "waves"
  | "circuit";

export interface CoverTheme {
  id: string;
  name: string;
  gradient: string;
  ink: string;
  accent: string;
  edge: string;
  pattern: CoverPattern;
  /** Heading font stack for the cover title. */
  font: string;
  /** Uppercase + wide tracking headline treatment. */
  display: boolean;
}

export const COVER_THEMES: CoverTheme[] = [
  {
    id: "modern-minimal",
    name: "Modern Minimal",
    gradient: "linear-gradient(160deg,#f7f7f5,#e6e6e2)",
    ink: "#1c1c1c",
    accent: "#111111",
    edge: "#cfcfc9",
    pattern: "none",
    font: "'Helvetica Neue', Inter, system-ui, sans-serif",
    display: false,
  },
  {
    id: "maths-blueprint",
    name: "Mathematics Blueprint",
    gradient: "linear-gradient(160deg,#0b2d5c,#07203f)",
    ink: "#e8f1ff",
    accent: "#7fc4ff",
    edge: "#0a3a75",
    pattern: "blueprint",
    font: "'Courier New', ui-monospace, monospace",
    display: true,
  },
  {
    id: "academic-gold",
    name: "Academic Gold",
    gradient: "linear-gradient(160deg,#2b1c07,#120a02)",
    ink: "#f6e6c2",
    accent: "#e2b martial",
    edge: "#4a3312",
    pattern: "geometry",
    font: "Georgia, 'Times New Roman', serif",
    display: true,
  },
  {
    id: "dark-professional",
    name: "Dark Professional",
    gradient: "linear-gradient(160deg,#1b1d22,#0c0d10)",
    ink: "#e7e9ee",
    accent: "#8ea0b8",
    edge: "#2a2d34",
    pattern: "none",
    font: "Inter, system-ui, sans-serif",
    display: false,
  },
  {
    id: "futuristic-stem",
    name: "Futuristic STEM",
    gradient: "linear-gradient(160deg,#08131f,#04212b)",
    ink: "#d8fbff",
    accent: "#31e3c2",
    edge: "#0d3b45",
    pattern: "circuit",
    font: "'Space Grotesk', Inter, sans-serif",
    display: true,
  },
  {
    id: "science-maths",
    name: "Science & Mathematics",
    gradient: "linear-gradient(160deg,#12233b,#1c3a5e)",
    ink: "#eaf3ff",
    accent: "#ffd166",
    edge: "#284a72",
    pattern: "grid",
    font: "Inter, system-ui, sans-serif",
    display: false,
  },
  {
    id: "childrens-primary",
    name: "Children's Primary",
    gradient: "linear-gradient(160deg,#ff9a5a,#ff5d8f)",
    ink: "#331313",
    accent: "#fff2b2",
    edge: "#ff8bb0",
    pattern: "dots",
    font: "'Comic Sans MS', 'Baloo 2', system-ui, sans-serif",
    display: false,
  },
  {
    id: "elegant-notebook",
    name: "Elegant Notebook",
    gradient: "linear-gradient(160deg,#f4ece1,#e2d3bd)",
    ink: "#3b2f21",
    accent: "#8b6b3d",
    edge: "#cbb896",
    pattern: "none",
    font: "'Cormorant Garamond', Georgia, serif",
    display: false,
  },
  {
    id: "geometry-theme",
    name: "Geometry Theme",
    gradient: "linear-gradient(160deg,#241b3a,#0f0a1c)",
    ink: "#efe8ff",
    accent: "#b18cff",
    edge: "#3a2c5c",
    pattern: "geometry",
    font: "Inter, system-ui, sans-serif",
    display: true,
  },
  {
    id: "premium-university",
    name: "Premium University",
    gradient: "linear-gradient(160deg,#0d2a24,#06150f)",
    ink: "#eaf6ee",
    accent: "#d4af37",
    edge: "#1d4438",
    pattern: "waves",
    font: "Georgia, 'Times New Roman', serif",
    display: true,
  },
];

export const themeById = (id?: string | null): CoverTheme =>
  COVER_THEMES.find((t) => t.id === id) ?? COVER_THEMES[0];

export interface CoverRow {
  label: string;
  value: string;
}

export interface NotebookCoverConfig {
  themeId: string;
  /** Small line above the title. */
  eyebrow: string;
  /** Main title on the cover. */
  title: string;
  /** Line under the title. */
  subtitle: string;
  /** Corner badge text ("" hides it). */
  badge: string;
  /** Editable label/value lines at the foot of the cover. */
  rows: CoverRow[];
  /** Storage path of an AI-generated cover artwork (game-assets bucket). */
  artPath?: string | null;
  /** How strongly the artwork shows through (0..1). */
  artOpacity?: number;
}

export interface NotebookSeed {
  title?: string | null;
  subject?: string;
  subtopic?: string;
  teacher?: string;
  class_name?: string;
  session?: string;
}

/** Default cover text derived from the notebook's own details. */
export const defaultCoverConfig = (nb: NotebookSeed): NotebookCoverConfig => ({
  themeId: COVER_THEMES[1].id,
  eyebrow: "MathGPL",
  title: nb.title?.trim() || nb.subject || "Notebook",
  subtitle: nb.subtopic?.trim() || "Lesson Notes",
  badge: "Teacher",
  rows: [
    { label: "Teacher", value: nb.teacher ?? "" },
    { label: "Class", value: nb.class_name ?? "" },
    { label: "Session", value: nb.session ?? "" },
    { label: "Subject", value: nb.subject ?? "" },
  ],
});

/** Normalises whatever is stored in the DB into a usable config. */
export const readCoverConfig = (
  raw: unknown,
  nb: NotebookSeed,
): NotebookCoverConfig => {
  const base = defaultCoverConfig(nb);
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<NotebookCoverConfig>;
  return {
    themeId: r.themeId ?? base.themeId,
    eyebrow: r.eyebrow ?? base.eyebrow,
    title: r.title ?? base.title,
    subtitle: r.subtitle ?? base.subtitle,
    badge: r.badge ?? base.badge,
    rows: Array.isArray(r.rows) && r.rows.length ? r.rows : base.rows,
    artPath: r.artPath ?? null,
    artOpacity: typeof r.artOpacity === "number" ? r.artOpacity : 0.55,
  };
};

/** The 10 starter themes, pre-filled with the notebook's own text. */
export const suggestCoverThemes = (nb: NotebookSeed): NotebookCoverConfig[] => {
  const base = defaultCoverConfig(nb);
  return COVER_THEMES.map((t) => ({ ...base, themeId: t.id }));
};
