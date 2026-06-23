// Lesson Context — compact snapshot of the current lesson that the
// Floating Number AI Assistant uses as live context on every turn.
//
// This is the shared mathematical understanding between the Lesson
// Note Generator (which produces examples) and the Floating Number
// AI (which reasons about them). Keep it small — the server hydrates
// full law text and document excerpts from IDs.

export interface LessonContext {
  notebookId: string | null;
  subsectionId: string | null;
  /** Lesson topic — usually the notebook subtopic ("Partial Fractions"). */
  topic: string | null;
  /** Broader subject ("Mathematics", "Further Maths"…). */
  subject: string | null;
  /** Section kind: example / exercise / classwork / homework. */
  sectionKind: string | null;
  /** The current problem statement (verbatim from the Lesson Note). */
  problem: string | null;
  /** Up to N most recent worked-example equation lines. */
  recentExamples: { lineId: string; text: string }[];
  /** The line the teacher is actively working on. */
  activeLineId: string | null;
  activeLineText: string | null;
  /** Live workspace state of the active line, so the AI sees the latest
   *  manual edits and can propose targeted patches (move/add/remove). */
  activeLineFillers: string[];
  activeLineContainers: string[];
  activeLineArrangement: number[];
}

export const emptyLessonContext = (): LessonContext => ({
  notebookId: null,
  subsectionId: null,
  topic: null,
  subject: null,
  sectionKind: null,
  problem: null,
  recentExamples: [],
  activeLineId: null,
  activeLineText: null,
  activeLineFillers: [],
  activeLineContainers: [],
  activeLineArrangement: [],
});

export const buildLessonContext = (input: Partial<LessonContext>): LessonContext => ({
  ...emptyLessonContext(),
  ...input,
  recentExamples: (input.recentExamples ?? []).slice(0, 6),
});
