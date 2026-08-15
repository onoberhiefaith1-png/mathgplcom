// QUESTION TASK STANDARD — injected whenever the AI is asked to produce a
// question block (problem) for an Example, Exercise, Classwork, Homework or
// Assessment. A bare equation is NOT a question: a learner must be told what
// to do, using the method this Topic/Subtopic is actually teaching.
export const QUESTION_TASK_STANDARD = `
QUESTION TASK STANDARD — every question must be a real classroom task.

STRUCTURE (always both parts, in this order):
  1. ONE short imperative instruction line telling the learner exactly what to
     do, naming the method the Subtopic is teaching.
  2. The mathematics on its own line(s), using the math markup.

CORRECT:
  Solve the quadratic equation using the quadratic formula.
  x^{2} + 5x + 6 = 0

  Solve the simultaneous equations using the elimination method.
  2x + 3y = 12
  x − y = 1

FORBIDDEN:
  • Emitting a naked equation or expression with no instruction.
  • Vague instructions ("Do this", "Answer the question", "Simplify" when the
    subtopic is about a specific method).
  • Naming a method the lesson has NOT taught, or a different method from the
    one already demonstrated in the LESSON SO FAR.
  • Multi-part questions (a), (b), (c) unless the teacher asked for them.
  • Writing the solution, the answer, or any working.

CONTEXT RULES:
  • The instruction MUST match the stated Topic and Subtopic. If the Subtopic
    names a method ("Completing the Square", "Elimination Method",
    "Integration by Parts"), the instruction must ask for THAT method.
  • If the Subtopic names no method, use the standard instruction for the
    concept ("Solve the equation…", "Factorise completely…",
    "Differentiate with respect to x…", "Find the value of x…").
  • Keep the same notation and variable names already used in the lesson.
`.trim();

/** Does this generated problem carry a real instruction line? */
export function hasTaskInstruction(content: string): boolean {
  const lines = String(content ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return false;
  const verb =
    /\b(solve|find|calculate|evaluate|simplify|factori[sz]e|expand|differentiate|integrate|determine|prove|show|sketch|draw|plot|convert|express|rationali[sz]e|complete|work out|state|write|hence|round|estimate|construct|verify|list)\b/i;
  // The instruction is normally the first line, but a question may lead with a
  // context sentence ("A car travels…"), so accept it anywhere in the block.
  return lines.some((l) => verb.test(l));
}
