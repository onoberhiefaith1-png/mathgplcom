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

/** ONLY diagrams and graphs are carried across to the working board.
 *  Tables, equations, text, emojis, images, calculator/conversion working and
 *  every other lesson-note object stay on Board A exactly as before. */
export const boardForObject = (o: Pick<SolutionObject, "nodeType" | "family">): BoardId =>
  o.family === "diagram" ? "B" : "A";

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
