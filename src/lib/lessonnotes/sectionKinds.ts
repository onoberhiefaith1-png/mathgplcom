// Single source of truth for section names <-> kinds (matches the existing
// notebook-ai contract: introduction | explanation | example | exercise |
// classwork | homework | summary).

export type SectionKind =
  | "introduction" | "explanation" | "example" | "exercise"
  | "classwork" | "homework" | "assessment" | "summary" | "objectives"
  | "solution" | "game_questions";

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
};

/** Order used by the "Whole lesson" global AI flow. */
export const WHOLE_LESSON_ORDER: SectionKind[] = [
  "introduction",
  "objectives",
  "explanation",
  "example",
  "exercise",
  "classwork",
  "homework",
  "assessment",
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

/** Edge-function payload helpers. */
export function blockKindFor(kind: SectionKind): "solution" | "text" {
  if (kind === "solution") return "solution";
  return kind === "example" || kind === "exercise" || kind === "classwork" ||
         kind === "homework" || kind === "assessment" || kind === "game_questions" ? "solution" : "text";
}

/** Map our kind to one the notebook-ai edge accepts (it doesn't know "assessment" / "objectives"). */
export function aiSectionKind(kind: SectionKind): string {
  if (kind === "solution") return "example";
  if (kind === "assessment") return "exercise";
  if (kind === "objectives") return "explanation";
  if (kind === "game_questions") return "exercise";
  return kind;
}
