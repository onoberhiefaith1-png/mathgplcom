// Reading the SOLUTION that belongs to a diagram's question.
//
// The Geometry Map is derived from the solution, so it needs the solution the
// lesson note actually shows for that question — nothing else in the note, and
// never another question's working.

import type { Node as PMNode } from "@tiptap/pm/model";
import { ownerQuestionHeadingFor } from "@/lib/lessonnotes/containerRange";

function isSolutionHeading(text: string): boolean {
  const t = (text || "").toLowerCase().trim();
  return t.startsWith("solution") || t.includes("worked solution");
}

function isStructuralHeading(n: PMNode): boolean {
  return n.type.name === "heading" && ((n.attrs as { level?: number })?.level ?? 6) <= 2;
}

export interface DiagramQuestionContext {
  question: string;
  solution: string;
}

/**
 * Walks the note's top level from the diagram's owning question heading and
 * returns that question's text plus the text of its Solution block(s).
 * Stops at the next question heading, so nothing bleeds across questions.
 */
export function questionContextForPos(doc: PMNode, pos: number): DiagramQuestionContext {
  const owner = ownerQuestionHeadingFor(doc, pos);
  const questionLines: string[] = [];
  const solutionLines: string[] = [];
  if (!owner) return { question: "", solution: "" };

  let started = false;
  let inSolution = false;
  doc.forEach((child, offset) => {
    if (!started) {
      if (offset === owner.pos) {
        started = true;
        questionLines.push(child.textContent);
      }
      return;
    }
    if (isStructuralHeading(child)) {
      if (isSolutionHeading(child.textContent)) {
        inSolution = true;
        return;
      }
      // next question begins — stop collecting
      started = false;
      return;
    }
    const text = child.textContent.trim();
    if (!text) return;
    if (inSolution) solutionLines.push(text);
    else questionLines.push(text);
  });

  return {
    question: questionLines.join("\n").trim(),
    solution: solutionLines.join("\n").trim(),
  };
}
