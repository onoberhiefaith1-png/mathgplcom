// Suggestions shown when the teacher opens AI Edit and clicks Generate with
// an empty input box. Each suggestion, when picked, fills the input and runs
// the same Mode A generation as if the teacher typed it.
import type { SelectionKind } from "./detectSelectionKind";

export const EDIT_SUGGESTIONS: Record<SelectionKind, string[]> = {
  solution: [
    "Add Missing Steps",
    "Use Benchmark Method",
    "Improve Explanation",
    "Simplify",
    "Convert to Lesson Note Format",
    "Convert to Smartboard Format",
    "Make Student Friendly",
    "Make Teacher Friendly",
    "Use Correct Structure",
  ],
  fraction: [
    "Fix Fraction Structure",
    "Improve Fraction Layout",
    "Convert to Proper Fraction Object",
    "Use Correct Structure",
  ],
  matrix: [
    "Fix Matrix Structure",
    "Improve Matrix Layout",
    "Resize Matrix Brackets",
    "Use Correct Structure",
  ],
  equation: [
    "Fix Rendering",
    "Use Correct Structure",
    "Add Missing Steps",
    "Simplify",
  ],
  paragraph: [
    "Rewrite",
    "Improve Explanation",
    "Simplify",
    "Expand",
    "Convert to Classroom Style",
  ],
  lesson_section: [
    "Rewrite",
    "Expand",
    "Use Benchmark Method",
    "Convert to Smartboard Format",
  ],
};

export const SELECTION_KIND_LABELS: Record<SelectionKind, string> = {
  solution: "Solution",
  fraction: "Fraction",
  matrix: "Matrix",
  equation: "Equation",
  paragraph: "Paragraph",
  lesson_section: "Lesson Section",
};

/** Tokens that force the edge function to load every standard at once. */
const STANDARDS_TRIGGER_RE =
  /correct structure|fix structure|wrong structure|benchmark|standard|fix rendering|improve layout/i;

export const instructionTriggersStandards = (s: string) => STANDARDS_TRIGGER_RE.test(s || "");
