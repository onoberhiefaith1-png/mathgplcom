// Solution completeness — the hard contract for every teacher-facing solution.
//
// A solution that stops half way is worse than no solution at all: the floating
// number pipeline and the assignment/practice follow-up both read the finished
// solution, so a truncated solution silently removes those features. The prompt
// below states the contract, and `checkSolutionCompleteness` is the
// deterministic gate that decides whether the model honoured it.

export const SOLUTION_COMPLETENESS_STANDARD = `
SOLUTION COMPLETENESS CONTRACT (NON-NEGOTIABLE)

A solution is only finished when ALL of the following are true:

1. RESTATEMENT — the first line(s) restate the question exactly as given
   (QUESTION_LOCK). Never a paraphrase, never new numbers.
2. ONE MICRO-STEP PER LINE, IN ORDER — each line follows from the line directly
   above it. Never skip a transition, never merge two operations into one line,
   never write a step out of order.
3. NO DANGLING LINE — the last line must be complete mathematics. It may never
   end on an operator (+ − × ÷ =), an open bracket, an unfinished fraction, an
   unfinished root, an unfinished power, or a trailing comma.
4. AN EXPLICIT FINAL ANSWER LINE — the solution ends with the answer stated as a
   finished statement (for example "x = 4", "∠ABC = 63°", "Area = 24 cm²").
   Ending on the second-to-last manipulation is a FAILURE, not a style choice.
5. LENGTH IS NEVER AN EXCUSE — if the working is long, keep writing until the
   answer line exists. Never write "and so on", "continue similarly", "…",
   "(steps omitted)" or any other abbreviation of the working.

If you notice you are running out of room, shorten the wording of each step —
never stop before the final answer line.
`.trim();

const OPEN_ENDED_TAIL =
  /(?:[+\-−×÷*/=^_,]|\\frac|\\sqrt|\\|…|\.\.\.|\bthen\b|\bso\b|\band\b)\s*$/i;

const ABBREVIATION = /(?:and so on|continue similarly|steps omitted|etc\.?$|…|\.\.\.)/i;

/**
 * A non-terminating decimal ("σ = 1.024695076…") is real mathematics, not an
 * abbreviation of the working. Strip that trailing ellipsis before the
 * abbreviation / dangling-tail tests so it can never be read as a cut-off step.
 */
const stripDecimalEllipsis = (s: string): string =>
  s.replace(/(\d)\s*(?:\.\.\.|…)/g, "$1");

/**
 * Final-answer shapes we accept. Classroom solutions state the answer in many
 * legitimate ways — "x = 4", "σ ≈ 1.02", "Standard deviation = 0.96 hours",
 * "Therefore the mean height is 34.6 cm", "∴ Area = 24 cm²", or simply a
 * finished value with its unit. All of these are answers, so the gate accepts
 * them rather than demanding one house style.
 */
const isAnswerLine = (line: string): boolean => {
  const t = line.trim();
  if (!t) return false;
  // A statement carrying a relation and a value on its right-hand side.
  if (/[=≈≡]\s*[^\s=]/.test(t)) return true;
  // A concluding statement ("Therefore …", "∴ …", "Answer: …", "The mean is …").
  if (/^(?:answer|therefore|hence|thus|so|∴|the\b|final\b)/i.test(t)) return true;
  // A finished value, optionally with a unit or a rounding note.
  if (/\d\s*(?:[a-zA-Z°%µ][a-zA-Z0-9²³/·^.\s]*)?[).\]]?\s*$/.test(t)) return true;
  return false;
};

/** The answer may sit on the last line, or just above a closing remark. */
const hasAnswerLine = (lines: string[]): boolean =>
  lines.slice(-3).some(isAnswerLine);

export interface SolutionCompletenessResult {
  ok: boolean;
  defects: string[];
}

const nonEmpty = (s: string): string[] =>
  String(s ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

const balanced = (s: string): boolean => {
  const pairs: Array<[string, string]> = [["(", ")"], ["[", "]"], ["{", "}"]];
  for (const [open, close] of pairs) {
    let depth = 0;
    for (const ch of s) {
      if (ch === open) depth++;
      else if (ch === close) depth--;
      if (depth < 0) return false;
    }
    if (depth !== 0) return false;
  }
  return true;
};

/**
 * Deterministic completeness gate for a generated solution.
 *
 * `truncated` is the transport-level signal (the model hit its length limit);
 * it is always a defect, whatever the text looks like.
 */
export function checkSolutionCompleteness(
  solution: string,
  opts: { truncated?: boolean } = {},
): SolutionCompletenessResult {
  const defects: string[] = [];
  const lines = nonEmpty(solution);

  if (opts.truncated) {
    defects.push("The solution was cut off before it finished (length limit reached).");
  }
  if (!lines.length) {
    return { ok: false, defects: ["The solution is empty."] };
  }
  if (lines.length < 2) {
    defects.push("The solution restates the question but shows no working.");
  }

  const last = lines[lines.length - 1] ?? "";
  if (OPEN_ENDED_TAIL.test(stripDecimalEllipsis(last))) {
    defects.push(`The last line "${last}" is unfinished — it ends mid-step.`);
  }
  if (!balanced(last)) {
    defects.push(`The last line "${last}" has an unclosed bracket.`);
  }
  if (!ANSWER_LINE.test(last)) {
    defects.push(
      "There is no explicit final answer line — the solution stops before stating the answer.",
    );
  }
  for (const l of lines) {
    if (ABBREVIATION.test(stripDecimalEllipsis(l))) {
      defects.push(`The working is abbreviated instead of written out: "${l}".`);
      break;
    }
  }
  for (const l of lines) {
    if (!balanced(l)) {
      defects.push(`A step has an unbalanced bracket: "${l}".`);
      break;
    }
  }

  return { ok: defects.length === 0, defects };
}

/** Corrective instruction naming the exact defects for a bounded regeneration. */
export function completenessCorrector(
  result: SolutionCompletenessResult,
  previous: string,
): string {
  return `Your previous solution is INCOMPLETE. It failed the solution completeness contract:

${result.defects.map((d) => `- ${d}`).join("\n")}

${SOLUTION_COMPLETENESS_STANDARD}

Rewrite the WHOLE solution from the same question, unchanged in mathematics, but
carry it through to an explicit final answer line. Keep every step in order, one
micro-step per line. Output only the solution — no commentary, no labels.

PREVIOUS (INCOMPLETE) SOLUTION:
${previous}`;
}
