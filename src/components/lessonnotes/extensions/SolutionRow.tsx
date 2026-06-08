// Two-column "Solution | Explanation" row for worked examples / exercises.
// Pure layout node — left cell ("solutionMath") holds calculations
// (mathBlock + paragraph), right cell ("solutionProse") holds the narrative
// (Recall…, Multiply by the conjugate…, Split into real and imaginary…).
// Both cells are normal editable block containers, so the teacher can edit,
// add, or delete content in either side without any special UI.

import { Node, mergeAttributes } from "@tiptap/core";

export const SolutionMath = Node.create({
  name: "solutionMath",
  group: "solutionCell",
  content: "block+",
  isolating: true,
  parseHTML() { return [{ tag: "div[data-solution-math]" }]; },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-solution-math": "", class: "solution-math" }), 0];
  },
});

export const SolutionProse = Node.create({
  name: "solutionProse",
  group: "solutionCell",
  content: "block+",
  isolating: true,
  parseHTML() { return [{ tag: "div[data-solution-prose]" }]; },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-solution-prose": "", class: "solution-prose" }), 0];
  },
});

export const SolutionRow = Node.create({
  name: "solutionRow",
  group: "block",
  content: "solutionMath solutionProse",
  defining: true,
  parseHTML() { return [{ tag: "div[data-solution-row]" }]; },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-solution-row": "", class: "solution-row" }), 0];
  },
});
