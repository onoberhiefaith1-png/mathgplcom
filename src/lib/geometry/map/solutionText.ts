// Reading the QUESTION and the SOLUTION that belong to a diagram.
//
// The Geometry Map is derived from the solution, so it must read the solution
// of the diagram's OWN question — never the caret's question, never another
// question's working. A lesson note can hold ten diagrams; each one resolves
// its own question → solution pair through this module.
//
// Solutions do not always sit at the note's top level: they can be a level-3
// "Solution" heading in the flowing body, or live inside a `solutionMath` /
// `solutionProse` cell or a free `canvasFrame` owned by the question. All of
// those are collected here.

import type { Node as PMNode } from "@tiptap/pm/model";
import { ownerQuestionHeadingFor, sectionEndWithin } from "@/lib/lessonnotes/containerRange";

const FRAME_NODES = new Set(["canvasFrame", "solutionMath", "solutionProse"]);

export function isSolutionHeadingText(raw: string): boolean {
  const t = String(raw ?? "").trim().toLowerCase().replace(/[:.\s]+$/, "");
  return t === "solution" || /^solution\b/.test(t) || t.includes("worked solution");
}

export interface DiagramQuestionContext {
  /** Stable `sectionId` of the owning question heading, when it has one. */
  questionId: string | null;
  /** The heading text — "Example 3", "Question 2"… */
  questionLabel: string;
  question: string;
  solution: string;
  /** Fingerprint of the solution text; changes ⇒ an existing map is stale. */
  solutionHash: string;
  hasSolution: boolean;
}

export const EMPTY_QUESTION_CONTEXT: DiagramQuestionContext = {
  questionId: null,
  questionLabel: "",
  question: "",
  solution: "",
  solutionHash: "",
  hasSolution: false,
};

/** Cheap, stable fingerprint of the solution text. */
export function hashSolution(text: string): string {
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${(h >>> 0).toString(36)}_${s.length}`;
}

function collectText(node: PMNode, into: string[]): void {
  node.forEach((child) => {
    if (child.isTextblock) {
      const t = child.textContent.trim();
      if (t) into.push(t);
      return;
    }
    if (child.childCount) collectText(child, into);
  });
}

/**
 * The question text and the Solution text of the question that owns `pos`.
 * Collection never crosses into another question.
 */
export function questionContextForPos(doc: PMNode, pos: number): DiagramQuestionContext {
  const owner = ownerQuestionHeadingFor(doc, pos);
  if (!owner) return EMPTY_QUESTION_CONTEXT;

  const questionId =
    typeof (owner.node.attrs as { sectionId?: string })?.sectionId === "string" &&
    (owner.node.attrs as { sectionId?: string }).sectionId
      ? ((owner.node.attrs as { sectionId?: string }).sectionId as string)
      : null;
  const sectionEnd = sectionEndWithin(doc, owner.pos);

  const questionLines: string[] = [];
  const solutionLines: string[] = [];
  let inSolution = false;
  let solutionLevel = 6;

  // One ordered pass through the question's own span, frames included.
  doc.descendants((node, p) => {
    if (p < owner.pos) return true;
    if (p >= sectionEnd) return false;

    if (node.type.name === "heading") {
      const level = ((node.attrs as { level?: number })?.level ?? 6) as number;
      if (isSolutionHeadingText(node.textContent)) {
        inSolution = true;
        solutionLevel = level;
        return false;
      }
      if (inSolution && level <= solutionLevel) inSolution = false;
      questionLines.push(node.textContent.trim());
      return false;
    }

    // A Solution cell is solution content by definition.
    if (node.type.name === "solutionMath" || node.type.name === "solutionProse") {
      const lines: string[] = [];
      collectText(node, lines);
      solutionLines.push(...lines.filter((l) => !isSolutionHeadingText(l)));
      return false;
    }

    if (FRAME_NODES.has(node.type.name)) return true;

    if (node.isTextblock) {
      const t = node.textContent.trim();
      if (t) (inSolution ? solutionLines : questionLines).push(t);
      return false;
    }
    return true;
  });

  // Free frames the question explicitly owns can hold its Solution too.
  if (questionId) {
    doc.descendants((n, p) => {
      if (n.type.name !== "canvasFrame") return true;
      if (p >= owner.pos && p < sectionEnd) return false; // already walked
      const frameOwner = (n.attrs as { ownerQuestionId?: string | null })?.ownerQuestionId ?? null;
      if (frameOwner !== questionId) return false;
      const lines: string[] = [];
      collectText(n, lines);
      let frameSolution = false;
      lines.forEach((line) => {
        if (isSolutionHeadingText(line)) { frameSolution = true; return; }
        if (frameSolution) solutionLines.push(line);
      });
      return false;
    });
  }

  const solution = solutionLines.join("\n").trim();
  return {
    questionId,
    questionLabel: owner.node.textContent.trim(),
    question: questionLines.join("\n").trim(),
    solution,
    solutionHash: hashSolution(solution),
    hasSolution: solution.length > 0,
  };
}

/** Position of the question heading carrying `questionId`, if it still exists. */
export function questionHeadingPos(doc: PMNode, questionId: string): number | null {
  let found: number | null = null;
  doc.descendants((n, p) => {
    if (found != null) return false;
    if (n.type.name !== "heading") return true;
    if ((n.attrs as { sectionId?: string })?.sectionId === questionId) { found = p; return false; }
    return true;
  });
  return found;
}

/**
 * Context resolved from a diagram's PERMANENT owner question id — the binding
 * that survives scrolling, clicking elsewhere and re-opening the note. Falls
 * back to the diagram's own position when the id is missing or stale.
 */
export function questionContextForOwner(
  doc: PMNode,
  ownerQuestionId: string | null | undefined,
  fallbackPos: number | null,
): DiagramQuestionContext {
  if (ownerQuestionId) {
    const at = questionHeadingPos(doc, ownerQuestionId);
    if (at != null) return questionContextForPos(doc, at + 1);
  }
  if (fallbackPos == null) return EMPTY_QUESTION_CONTEXT;
  return questionContextForPos(doc, fallbackPos);
}
