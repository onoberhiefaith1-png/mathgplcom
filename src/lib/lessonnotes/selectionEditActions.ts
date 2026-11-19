// One-step actions for a highlighted lesson-note selection. The instructions
// name the action; MIXED_MCQ_GUIDANCE is appended by the panel from the same
// definition the parser uses, so the two cannot describe different rules.

export interface SelectionEditAction {
  id: "fix" | "mcq" | "worked" | "rewrite";
  label: string;
  instruction: string;
}

export const SELECTION_EDIT_ACTIONS: readonly SelectionEditAction[] = [
  {
    id: "fix",
    label: "Fix",
    instruction:
      "Fix this selection only. Keep the teacher's words, numbers, and any declared answer. " +
      "Keep variant labels such as V1, V1. Beginner/JSS:, and Intermediate/SSS: exactly as written. " +
      "If the selection has a stem, options, and a declared answer, it is a multiple-choice question: do not add a Solution or Floating Numbers, and move any Explanation, Reason, or Working into its own Explanation section. " +
      "If it has no options, keep it as a worked question with its solution.",
  },
  {
    id: "mcq",
    label: "Convert to MCQ",
    instruction:
      "Turn this selection into a multiple-choice question. Keep the stem and any variant labels exactly as written. " +
      "Keep a declared correct answer exactly. If the answer appears only in the working, the correct option must be that same result. Do not invent a different answer. " +
      "Do not add a Solution or Floating Numbers. Move any explanation into an Explanation section.",
  },
  {
    id: "worked",
    label: "Convert to worked solution",
    instruction:
      "Turn this selection into a worked question with a Solution section and the steps. Remove multiple-choice options. " +
      "Keep the stem, the variant labels, and the same final answer. Do not change the answer.",
  },
  {
    id: "rewrite",
    label: "Rewrite",
    instruction:
      "Rewrite this selection more clearly for students. Keep the same kind of question: a multiple-choice question stays multiple-choice with the same options and the same declared answer; a worked question stays worked. " +
      "Keep variant labels exactly as written.",
  },
];
