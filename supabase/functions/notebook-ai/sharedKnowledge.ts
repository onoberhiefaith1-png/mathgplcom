// SHARED MATHGPL KNOWLEDGE LAYER
//
// One canonical bundle of the standards that make MathGPL produce professional
// classroom mathematics. Co-Pilot generation and selection-based AI Edit both
// read from HERE, so neither can drift to a weaker set of rules. No standard
// text is rewritten in this module — it only composes the existing standards.

import { RENDERING_STANDARD } from "./renderingStandard.ts";
import { STRUCTURAL_STANDARD } from "./structuralStandard.ts";
import { WORKSPACE_STANDARD } from "./workspaceStandard.ts";
import { TABLE_RECOGNITION_STANDARD } from "./tableStandard.ts";
import { BENCHMARK_STANDARD } from "./benchmarkStandard.ts";
import { CONTINUITY_STANDARD } from "./continuityStandard.ts";
import { INTEGRITY_STANDARD } from "./integrityStandard.ts";
import { SOLUTION_COMPLETENESS_STANDARD } from "./solutionCompletenessStandard.ts";
import { COPILOT_TRAINING_STANDARD } from "./copilotTrainingStandard.ts";

/** Presentation layer: how mathematics must be written and laid out. */
export function presentationKnowledgeBlocks(): string[] {
  return [
    RENDERING_STANDARD,
    STRUCTURAL_STANDARD,
    WORKSPACE_STANDARD,
    TABLE_RECOGNITION_STANDARD,
  ];
}

/**
 * Everything required to produce a professional worked solution:
 * presentation + benchmark library + the teaching reference + integrity and
 * completeness rules + the Co-Pilot training standard.
 */
export function solutionKnowledgeBlocks(pedagogyRules: string): string[] {
  return [
    ...presentationKnowledgeBlocks(),
    BENCHMARK_STANDARD,
    pedagogyRules,
    CONTINUITY_STANDARD,
    INTEGRITY_STANDARD,
    SOLUTION_COMPLETENESS_STANDARD,
    COPILOT_TRAINING_STANDARD,
  ];
}

/**
 * Knowledge for a selection-based edit. When the teacher's instruction asks for
 * a solution (generate / complete / improve / solve / work it out), AI Edit gets
 * the SAME bundle Co-Pilot uses for solutions — that is the whole point.
 */
export function editKnowledgeBlocks(opts: {
  pedagogyRules: string;
  solutionIntent: boolean;
  kind: string;
  forceAll?: boolean;
}): string[] {
  if (opts.solutionIntent || opts.kind === "solution" || opts.forceAll) {
    return solutionKnowledgeBlocks(opts.pedagogyRules);
  }
  const blocks = presentationKnowledgeBlocks();
  if (opts.kind === "lesson_section") blocks.push(opts.pedagogyRules);
  return blocks;
}

/**
 * Does this instruction ask AI Edit to produce or repair mathematics rather
 * than only reword it? Deliberately generous: a wrong positive only means the
 * model is given MORE of the standard, never less.
 */
export function wantsSolution(instruction: string, selection: string): boolean {
  const s = `${instruction}`.toLowerCase();
  if (
    /\b(solve|solution|work(ing)?\s+out|work it out|answer|prove|evaluate|simplify|calculate|find|determine|complete|continue|finish|derive|show (the )?(steps|working))\b/
      .test(s)
  ) return true;
  // No instruction at all on a question-looking fragment: the teacher wants it
  // worked, not reworded.
  if (!s.trim() && /\b(find|determine|calculate|evaluate|solve|prove|show that)\b/i.test(selection)) {
    return true;
  }
  return false;
}

/** The shape every AI-Edit-generated solution must follow. */
export const SOLUTION_SHAPE_DIRECTIVE = `
SOLUTION SHAPE (mandatory whenever you produce or repair a solution):
Understand → Method → Working → Explanation → Result.
- Open by stating what the question asks and the rule or method that applies,
  in the classroom language a teacher would use.
- Then write the working, ONE micro-step per line. Never skip a transition and
  never jump straight to the answer.
- Close with an explicit final answer line, with units or notation where the
  question requires them.
- A bare "Answer: ..." line on its own is NOT an acceptable solution.
- If the fragment already contains a solution: keep the mathematics that is
  correct, fix what is wrong, complete what is missing, and improve the
  explanation and presentation. Do not discard correct work.
`.trim();
