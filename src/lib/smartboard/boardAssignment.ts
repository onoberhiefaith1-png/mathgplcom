// TWO-BOARD ARCHITECTURE — which board owns a piece of lesson-note content.
//
// The Smartboard is ONE teaching environment with two synchronized boards:
//
//   BOARD A — the main teaching/presentation board: headings, text, questions,
//             explanations, solutions, equations, emojis.
//   BOARD B — the interactive mathematics board: Diagram, Table, Graph,
//             Calculator, Conversion.
//
// This module is the single, data-driven rule. Nothing else in the Smartboard
// should hard-code "diagrams go here" per feature or per example.

import type { SolutionObject } from "@/lib/floating/solutionItems";

export type BoardId = "A" | "B";

/** Node types that are narrative decoration and therefore stay on Board A. */
const BOARD_A_NODE_TYPES = new Set([
  "emoji",
  "emojiInline",
  "lessonEmoji",
  "image",
  "stepAnimation",
]);

/** The interactive mathematics objects that live on Board B. */
export const boardForObject = (o: Pick<SolutionObject, "nodeType" | "family">): BoardId => {
  if (BOARD_A_NODE_TYPES.has(o.nodeType)) return "A";
  // Everything captured as an object (table, diagram, graph, chart, 3D scene,
  // arithmetic visual, calculator working…) is Board-B content.
  return "B";
};

export const isBoardBObject = (o: Pick<SolutionObject, "nodeType" | "family">): boolean =>
  boardForObject(o) === "B";

/** Split a section's captured objects into the two boards, preserving order. */
export const splitObjectsByBoard = (
  objects: SolutionObject[] | undefined,
): { boardA: SolutionObject[]; boardB: SolutionObject[] } => {
  const boardA: SolutionObject[] = [];
  const boardB: SolutionObject[] = [];
  for (const o of objects ?? []) {
    (boardForObject(o) === "B" ? boardB : boardA).push(o);
  }
  return { boardA, boardB };
};
