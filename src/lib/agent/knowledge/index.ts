// The whole operational map, assembled.

import { ACCOUNT_NODES } from "./accounts";
import { CLASS_NODES } from "./classes";
import { LESSON_NODES } from "./lessonNotes";
import { ACTIVITY_NODES } from "./activities";
import { nodeIndexLine, nodePrompt, type KnowledgeNode } from "./types";

export type { KnowledgeNode } from "./types";
export { nodePrompt, nodeIndexLine, REQUIRED_NODE_FIELDS } from "./types";

export const KNOWLEDGE_NODES: KnowledgeNode[] = [
  ...ACCOUNT_NODES,
  ...CLASS_NODES,
  ...LESSON_NODES,
  ...ACTIVITY_NODES,
];

export const KNOWLEDGE_IDS = KNOWLEDGE_NODES.map((n) => n.id);

export function findKnowledge(id: string): KnowledgeNode | undefined {
  return KNOWLEDGE_NODES.find((n) => n.id === id);
}

/** Every workflow in one line each — Aura always carries this. */
export function knowledgeIndexPrompt(): string {
  return KNOWLEDGE_NODES.map(nodeIndexLine).join("\n");
}

/** The named workflows written out in full, for the surface in play. */
export function knowledgeDetailPrompt(ids: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const node = findKnowledge(id);
    if (node) out.push(nodePrompt(node));
  }
  return out.join("\n\n");
}

/**
 * The naming truths Aura must never get wrong. These travel with every turn,
 * because guessing them is the difference between real help and invention.
 */
export const NAMING_TRUTHS = `NAMES IN MATHGPL — NEVER GUESS THESE
- "Session" means one of three real things: a section on a lesson-note page (a
  custom section is literally labelled "Session"), a plain text session label on
  the notebook itself, or a scheduled MathGPL Live teaching room with its own
  code. Work out which one the teacher means from where they are; never invent a
  fourth kind of session and never treat a lesson note as having no sessions.
- Every question in a lesson note lives inside its own session: an Example,
  Exercise, Classwork, Homework or Assessment heading with its own Solution area.
  The Smartboard steps through the note session by session, so a question typed
  as ordinary prose cannot be taught. Always create the session first.
- "Quiz" does not exist. The real names are Assessment, and Exercise Card when
  the questions live inside a course.
- Floating Numbers are not objects dropped on a blank page. They are made in two
  stages: highlight spans of a written solution, then press Generate to turn each
  highlight into a line of chips with its container shells.
- There is no "tight" or "scattered" spacing control for Floating Numbers. What a
  teacher chooses is whether the chips start in solution order or are shuffled so
  students must rebuild the line, plus manual chip order and containers.
- "Test on Smartboard" saves nothing and records nothing — it is the teacher's dry
  run of one question. "Assign" is the real thing: the class sees it and answers
  come back.
- A class has both a class code and a shorter join code; the join code is what a
  student types.
- Lesson notes are the single source of questions. Courses, assignments,
  assessments, games and Adventures all reference lesson-note questions.`;

