// Single source of truth for section names <-> kinds (matches the existing
// notebook-ai contract: introduction | explanation | example | exercise |
// classwork | homework | summary).

export type SectionKind =
  | "introduction" | "explanation" | "example" | "exercise"
  | "classwork" | "homework" | "assessment" | "summary" | "objectives"
  | "solution" | "game_questions" | "custom_session";

export const SECTION_LABELS: Record<SectionKind, string> = {
  introduction: "Introduction",
  objectives: "Objectives",
  explanation: "Explanation",
  example: "Example",
  exercise: "Exercise",
  classwork: "Classwork",
  homework: "Homework",
  assessment: "Assessment",
  summary: "Summary",
  solution: "Solution",
  game_questions: "Game Questions",
  custom_session: "Session",
};

/** The seven standard sections offered by the ribbon "Section" menu.
 *  Objectives / Assessment are intentionally NOT offered any more; old notes
 *  that contain them keep rendering and stay AI-editable. */
export const INSERT_SECTION_OPTIONS: SectionKind[] = [
  "introduction", "explanation", "example",
  "exercise", "classwork", "homework", "summary",
];

/** Sections that come with a Solution area.
 *  RULE: every question that requires a solution is solved — assessment
 *  questions are solved for the teacher exactly like examples and homework. */
export const SOLUTION_SECTION_KINDS: ReadonlySet<SectionKind> = new Set([
  "example", "exercise", "classwork", "homework", "assessment",
]);

/** Order used by the "Whole lesson" global AI flow. */
export const WHOLE_LESSON_ORDER: SectionKind[] = [
  "introduction",
  "explanation",
  "example",
  "exercise",
  "classwork",
  "homework",
  "summary",
];

/** Sections that pedagogically can repeat (Example 2, Exercise 3, etc.).
 *  Shown with a "+ Add another" affordance at the end of the section. */
export const REPEATABLE_SECTION_KINDS: ReadonlySet<SectionKind> = new Set([
  "example", "exercise", "classwork", "homework", "assessment", "game_questions",
]);


/** Match a heading's text to a section kind (loose, case-insensitive). */
export function detectSectionKind(text: string): SectionKind | null {
  const t = (text || "").trim().toLowerCase();
  if (!t) return null;
  if (t.includes("game question") || t === "game questions") return "game_questions";
  if (t.includes("introduction") || t.startsWith("intro")) return "introduction";
  if (t.includes("objective")) return "objectives";
  if (t.includes("explanation") || t.includes("concept") || t.includes("theory")) return "explanation";
  if (t.includes("example")) return "example";
  if (t.includes("exercise")) return "exercise";
  if (t.includes("classwork") || t.includes("class work")) return "classwork";
  if (t.includes("homework") || t.includes("home work")) return "homework";
  if (t.includes("assessment") || t.includes("quiz") || t.includes("test")) return "assessment";
  if (t.includes("summary") || t.includes("recap") || t.includes("conclusion")) return "summary";
  if (t === "solution" || t.startsWith("solution ") || t.includes("worked solution")) return "solution";
  return null;
}

// ---------------------------------------------------------------------------
// STRUCTURAL RECOGNITION (deterministic — never AI, never loose matching)
//
// A session marker is a HEADING whose text IS the session name, optionally
// numbered ("Example 2", "Solution 1:"). Ordinary content such as
// "Introduction to cyclic quadrilaterals" or a paragraph that merely contains
// the word "introduction" is NEVER a marker. Headings inserted from the
// Section menu additionally carry a `sessionKind` stamp, which always wins.
// ---------------------------------------------------------------------------

/** Exact session names accepted as structural markers, longest first. */
const STRUCTURAL_NAMES: Array<[string, SectionKind]> = [
  ["worked solution", "solution"],
  ["game questions", "game_questions"],
  ["game question", "game_questions"],
  ["introduction", "introduction"],
  ["intro", "introduction"],
  ["objectives", "objectives"],
  ["objective", "objectives"],
  ["explanation", "explanation"],
  ["example", "example"],
  ["exercise", "exercise"],
  ["classwork", "classwork"],
  ["class work", "classwork"],
  ["homework", "homework"],
  ["home work", "homework"],
  ["assignment", "homework"],
  ["assessment", "assessment"],
  ["quiz", "assessment"],
  ["test", "assessment"],
  ["summary", "summary"],
  ["conclusion", "summary"],
  ["recap", "summary"],
  ["solution", "solution"],
];

export interface StructuralHeading {
  kind: SectionKind;
  /** Number written on the heading itself ("Example 2" → 2), else null. */
  number: number | null;
  /** The heading's own text, trimmed. */
  title: string;
}

/**
 * Strict structural classification of a heading.
 * Returns null for ordinary text and for descriptive headings.
 */
export function structuralHeadingKind(
  text: string,
  level: number,
  attrs?: { sessionKind?: unknown } | null,
): StructuralHeading | null {
  const title = (text || "").trim();
  const stamped = typeof attrs?.sessionKind === "string" ? attrs.sessionKind : "";
  const numberOf = (s: string): number | null => {
    const m = s.match(/(\d+)\s*[:.\-–]?\s*$/);
    return m ? Number(m[1]) : null;
  };
  if (stamped && stamped in SECTION_LABELS) {
    return { kind: stamped as SectionKind, number: numberOf(title), title };
  }
  if (!title || level > 3) return null;
  // Normalise: strip trailing punctuation, collapse whitespace, lowercase.
  const t = title.replace(/\s+/g, " ").replace(/[:.\-–—]+$/, "").trim().toLowerCase();
  if (!t) return null;
  for (const [name, kind] of STRUCTURAL_NAMES) {
    if (t === name) return { kind, number: null, title };
    // "example 2", "solution 1", "exercise no 3"
    const m = t.match(new RegExp(`^${name}\\s*(?:no\\.?|number|#)?\\s*(\\d{1,3})$`));
    if (m) return { kind, number: Number(m[1]), title };
  }
  return null;
}

/** Structural role of a heading inside a lesson note.
 *  - level 1 heading that is not a known section  → SUBTOPIC (structural)
 *  - level 2 heading that is not a known section  → custom session
 *  - anything matching a known section name       → that section */
export type HeadingRole =
  | { role: "subtopic"; title: string }
  | { role: "custom_session"; title: string }
  | { role: "section"; kind: SectionKind }
  | null;

export function headingRole(text: string, level: number): HeadingRole {
  const t = (text || "").trim();
  if (!t) return null;
  const kind = detectSectionKind(t);
  if (kind) return { role: "section", kind };
  if (level <= 1) return { role: "subtopic", title: t };
  if (level === 2) return { role: "custom_session", title: t };
  return null;
}

/** Edge-function payload helpers. `hasSolution` only matters for custom
 *  sessions, which the teacher creates with or without a Solution area. */
export function blockKindFor(kind: SectionKind, hasSolution = true): "solution" | "text" {
  if (kind === "solution") return "solution";
  if (kind === "custom_session") return hasSolution ? "solution" : "text";
  return kind === "example" || kind === "exercise" || kind === "classwork" ||
         kind === "homework" || kind === "assessment" || kind === "game_questions" ? "solution" : "text";
}

/** Map our kind to one the notebook-ai edge accepts (it doesn't know "assessment" / "objectives"). */
export function aiSectionKind(kind: SectionKind, hasSolution = true): string {
  if (kind === "solution") return "example";
  if (kind === "assessment") return "exercise";
  if (kind === "objectives") return "explanation";
  if (kind === "game_questions") return "exercise";
  if (kind === "custom_session") return hasSolution ? "example" : "explanation";

  return kind;
}
