// Premium section themes.
//
// One registry for every module's visual identity. Components never hardcode a
// colour: they ask for a theme key and get CSS values that resolve to the
// tokens declared in src/styles.css.

export type SectionThemeKey =
  | "lessonNotes"
  | "smartboard"
  | "classes"
  | "adventure"
  | "skillBuilder"
  | "reports"
  | "gallery"
  | "rewards"
  | "assessment"
  | "community"
  | "sessions"
  | "students"
  | "courses"
  | "assignments"
  | "games"
  | "settings"
  | "neutral";

const TOKEN: Record<SectionThemeKey, string> = {
  lessonNotes: "--section-lesson-notes",
  smartboard: "--section-smartboard",
  classes: "--section-classes",
  adventure: "--section-adventure",
  skillBuilder: "--section-skill-builder",
  reports: "--section-reports",
  gallery: "--section-gallery",
  rewards: "--section-rewards",
  assessment: "--section-assessment",
  community: "--section-community",
  sessions: "--section-sessions",
  students: "--section-students",
  courses: "--section-courses",
  assignments: "--section-assignments",
  games: "--section-games",
  settings: "--section-settings",
  neutral: "--section-neutral",
};

/** The gradient identity of one module, as a CSS `background-image` value. */
export const sectionSurface = (key: SectionThemeKey = "neutral"): string =>
  `var(${TOKEN[key] ?? TOKEN.neutral})`;

/**
 * Style object for a themed card: gradient surface plus the light sheen that
 * makes it read as a physical, elevated object.
 */
export const sectionCardStyle = (
  key: SectionThemeKey = "neutral",
): React.CSSProperties => ({
  backgroundImage: `var(--section-sheen), ${sectionSurface(key)}`,
  boxShadow: "var(--shadow-section)",
});

/** Style for a small themed chip (icon badge, top edge, avatar). */
export const sectionChipStyle = (
  key: SectionThemeKey = "neutral",
): React.CSSProperties => ({ backgroundImage: sectionSurface(key) });

/** Shared class list so every themed card behaves identically. */
export const SECTION_CARD_CLASS =
  "group relative isolate overflow-hidden rounded-2xl border border-section-ink/15 text-section-ink " +
  "transition-all duration-300 hover:-translate-y-1 hover:border-section-ink/30 " +
  "hover:shadow-[var(--shadow-section-hover)] active:translate-y-0 active:scale-[0.99] " +
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-section-ink/50";

export default sectionSurface;
