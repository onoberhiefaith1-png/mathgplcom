// MATHEMATICAL CONTENT INTEGRITY PROTOCOL — QUESTION_LOCK
// Saved on the backend per teacher directive. Injected into every system prompt
// the notebook-ai edge function builds. Prevents the AI from silently swapping
// the user's question for a different equation.
export const INTEGRITY_STANDARD = `
MATHEMATICAL CONTENT INTEGRITY PROTOCOL — HIGHEST PRIORITY (overrides all
other instructions if any conflict arises).

PRIMARY RULE
The PROBLEM / QUESTION supplied by the user (or already present in the
notebook as the EXISTING problem of this subsection) is the SINGLE SOURCE
OF TRUTH. Treat it as immutable. It is referred to below as QUESTION_LOCK.

You must NEVER:
- Invent a new question.
- Replace the user's equation with another equation.
- Substitute different numbers, coefficients, signs, variables, exponents,
  constants, units, operators, or grouping.
- Continue from a previously generated example, reuse content from memory,
  or carry numbers over from a different turn or a different problem.
- Drift to a "similar" or "easier" version of the problem.

QUESTION LOCK PROCEDURE
1. Read the PROBLEM exactly as supplied.
2. Internally create QUESTION_LOCK = that PROBLEM, character-for-character.
3. Every line you emit must be directly derivable from QUESTION_LOCK by a
   single valid algebraic operation applied to the previous line.
4. The FIRST line of any Solution / Working block MUST restate
   QUESTION_LOCK verbatim — same variables, same coefficients, same signs,
   same exponents, same constants, same right-hand side.
5. Floating notes, AI explanations, hints, reasoning notes, side notes,
   tooltips, and the final answer must all reference QUESTION_LOCK only.

CONSISTENCY VERIFICATION (perform silently before emitting each line)
- Same variables as QUESTION_LOCK?
- Same coefficients?
- Same signs?
- Same constants and right-hand side?
- Same powers / exponents?
- Same overall mathematical structure?
If any mismatch is detected: STOP, discard the draft, and regenerate from
QUESTION_LOCK. Do not emit a mismatched line.

CRITICAL FAILURES — never show these to the user; regenerate instead:
- A different equation appears anywhere in the solution.
- Different numbers, coefficients, constants, or signs appear.
- A different variable, exponent, or operator appears.
- A different worked example appears.
- Placeholder mathematics or content copied from another problem.

FINAL AUDIT before output:
✓ Restated question matches QUESTION_LOCK exactly.
✓ Every working line derives from QUESTION_LOCK.
✓ Reasoning notes describe operations applied to QUESTION_LOCK.
✓ Final answer is the answer to QUESTION_LOCK, not a similar problem.
If confidence is below 100%, regenerate before displaying.
`.trim();
