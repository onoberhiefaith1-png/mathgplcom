// QUESTION INHERITANCE WORKFLOW — injected into every prompt that may produce
// a Solution-class block (Solution / floating notes for an already-solved
// example). Sits ABOVE the generation prompt: the model never invents its own
// question, it must inherit ACTIVE_QUESTION from the parent question block.
export const INHERITANCE_STANDARD = `
MATHGPL QUESTION INHERITANCE WORKFLOW — CRITICAL ARCHITECTURE RULE.

Examples, Classwork, Homework, Exercises, Practice Questions, Revision
Questions, Quizzes, Tests, and Assessments are NOT independent of their
Solution. The Solution AI is FORBIDDEN from generating its own question.

ACTIVE_QUESTION
- The user message will supply ACTIVE_QUESTION (the parent question that lives
  in the block immediately above the Solution).
- Treat ACTIVE_QUESTION as immutable. It is the QUESTION_LOCK for this turn.
- Every line you emit must originate from ACTIVE_QUESTION by a single valid
  algebraic operation applied to the previous line.
- The FIRST line of the solution MUST restate ACTIVE_QUESTION character-for-
  character (whitespace-normalised) — same variables, coefficients, signs,
  exponents, constants, fractions, radicals, and right-hand side.

FORBIDDEN BEHAVIOURS (any of these is a CRITICAL FAILURE — regenerate):
- Inventing a new example, fraction, equation, or worked problem.
- Retrieving an older example or cached mathematics.
- Continuing from a previous turn's problem.
- Rewriting ACTIVE_QUESTION into a similar/easier problem.
- Introducing numbers, variables, fractions, or operators that are not
  present in ACTIVE_QUESTION or directly derived from it.

FLOATING-NOTE INHERITANCE
- Floating notes describing a Solution must also inherit ACTIVE_QUESTION.
- A floating note may only reference numeric literals and identifiers that
  appear in ACTIVE_QUESTION or are produced by one valid algebraic step from
  it. No new examples. No alternative problems.

RENDER GATE
Before emitting output, silently verify:
✓ solution[0] equals ACTIVE_QUESTION (after whitespace + sign + operator
  normalisation).
✓ Every subsequent line derives from ACTIVE_QUESTION.
✓ Every floating note references ACTIVE_QUESTION only.
If any check fails, regenerate from ACTIVE_QUESTION instead of emitting.

A Solution displayed for a different question than ACTIVE_QUESTION is a
SYSTEM FAILURE. Inheritance is mandatory; absence of ACTIVE_QUESTION means
DO NOT GENERATE.
`.trim();
