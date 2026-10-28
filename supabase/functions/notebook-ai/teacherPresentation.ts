// Teacher presentation is separate from correctness and from floating-token extraction.
// Append this policy last for lesson generation, not to marking or chip modes.
export const TEACHER_PRESENTATION_STANDARD = String.raw`
TEACHER-READY MATHEMATICS — TOPIC-SPECIFIC PRESENTATION
These layout rules refine generic "one micro-step per line" advice. Keep every
required calculation, but choose the conventional worked form for the topic.
Use the supplied curriculum level, method and teacher material; do not assume
all lessons are secondary school. Preserve established geometry, algebra and
statistics standards, diagram ownership and the original question verbatim.

GENERAL
Write like a teacher preparing a textbook worked example: brief method, complete
working, explicit result. Explain a new idea once; avoid repeated mechanical
instructions. Do not print Understand/Method/Working/Explanation/Result labels
merely to satisfy a template. A meaningful equality or proof inference is a
step. Keep prose notes separate from mathematical working so teachers can choose
which lines become Floating Numbers. Never omit worked solutions for examples.
Use genuine fractions, powers, roots, sums, integrals and limits; do not replace
mathematical notation with programming syntax. Preserve hypotheses and domains.

MATRICES AND LINEAR ALGEBRA
Check dimensions first: an m by n matrix times an n by p matrix gives m by p.
Keep each operand, the working matrix and final matrix in their correct shapes.
Show the row-times-column sums in the CORRESPONDING CELLS of ONE working matrix,
then simplify to the final matrix. For three by three products, all nine dot
products must be visible in their correct positions, including zero terms when
teaching the method. One complete working matrix is a valid parallel worked
stage; it does not require nine separate prose paragraphs or c11/c12/c13 labels.
Use c_ij notation when explaining the general rule or when explicitly requested,
not as repetitive scaffolding for a routine numerical product. If wide, put
successive matrices on separate lines; never flatten rows to fit the screen.
Use the native editable matrix directive on its own line, with explicit rows,
cols, bracket and exactly rows times cols pipe-separated slots in ROW-MAJOR order.
Keep zero and blank slots in position. For example, the working stage of a
2 by 2 product may be:
AB =
[[tool:structure kind="matrix" rows="2" cols="2" bracket="square" slots="1×5 + 2×7 | 1×6 + 2×8 | 3×5 + 4×7 | 3×6 + 4×8"]]
=
[[tool:structure kind="matrix" rows="2" cols="2" bracket="square" slots="19 | 22 | 43 | 50"]]
Do not emit typed bracket rows or tuple lists. Legacy LaTeX matrix inputs must
retain both row separators and column separators during editing/conversion.
For elimination show augmented matrices and row operations. Never multiply
matrices entry by entry unless the question explicitly asks for that operation.

TRIGONOMETRY
State degrees or radians and the permitted interval. Use identities correctly,
show substitutions and justified transformations. Keep exact values until an
approximation is requested. Find ALL solutions in the given interval using
quadrants/periodicity; do not return only an inverse-function principal value.
Do not divide by an expression that may vanish without checking the lost cases.
For an identity, transform a side with justified equalities; do not assume the
identity as a premise. Give restrictions where denominators are zero.

CALCULUS AND SERIES
Use proper derivative notation, integral signs, limits and summation notation
with their variables, indices and bounds. Distinguish a finite sum, infinite
series and its partial sums. Show the applicable rule and meaningful algebra.
For chain/product/quotient rules show the factors and inner derivative. For
substitution identify u and du and change definite bounds consistently.
Indefinite integrals require + C; definite integrals show the antiderivative
and upper-minus-lower evaluation, not + C in the numerical result. Check domain
and singularities; do not apply the fundamental theorem across a discontinuity
without the required improper-integral analysis. Preserve exact forms and units.

REAL ANALYSIS AND ADVANCED MATHEMATICS
Separate the statement, assumptions and proof. State the theorem and verify
its hypotheses before using it. Define variables, quantifiers and dependencies:
for epsilon-delta or sequence limits, take arbitrary epsilon > 0, choose the
required delta or N, and prove the bound for all permitted x or n. Keep the
inequality chain and the conclusion visible. A few numerical examples or a
graph are not proof. Do not infer uniform convergence from pointwise convergence,
interchange a limit/sum/integral without justification, or claim a theorem's
converse automatically. Give a counterexample when disproving a statement.
Use appropriate notation (limits, norms, sets, quantifiers, sums) and a concise
logical argument, rather than forcing every proof into calculator micro-steps.

FINAL SELF-REVIEW BEFORE RETURNING
Check the answer independently where possible, then check presentation:
matrix dimensions/cell order, exact signs, domains/units, complete trig solution
sets, constants/bounds in calculus, hypotheses/quantifiers in proofs. A correct
number with a malformed matrix is NOT teacher-ready. Repair the failed check
without changing the question. Never claim a deterministic check proves an
arbitrary advanced proof correct; acknowledge genuine mathematical uncertainty.
`.trim();

const LESSON_MODES = new Set([
  "copilot", "mathengine", "generate", "solve_with_reasoning", "edit", "blueprint", "review", "verify",
]);

/** Missing subject is the existing Mathematics default. Other subjects retain
 * their own standards. Floating/marking modes never receive lesson-layout rules. */
export function teacherPresentationForRequest(body: Record<string, any>): string {
  const subject = String(body.subject ?? body.snapshot?.subject ?? body.context?.subject ?? "Mathematics").trim();
  if (!/^(maths?|mathematics|further mathematics|additional mathematics|pure mathematics|applied mathematics)$/i.test(subject)) return "";
  return LESSON_MODES.has(body.mode) ? TEACHER_PRESENTATION_STANDARD : "";
}


/** Structural checks only: this cannot establish the correctness of a proof.
 * Used by bounded repairs and the final refusal gate before saving content. */
export function matrixPresentationIssues(text: string): string[] {
  const problems: string[] = [];
  for (const match of text.matchAll(/\[\[tool:structure\s+([^\]]*)\]\]/g)) {
    const params: Record<string, string> = {};
    for (const attr of match[1].matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+))/g)) {
      params[attr[1]] = attr[2] ?? attr[3] ?? attr[4];
    }
    if (params.kind !== "matrix") continue;
    const rows = Number(params.rows), cols = Number(params.cols);
    const slots = params.slots?.split("|") ?? [];
    if (!Number.isInteger(rows) || rows < 1 || !Number.isInteger(cols) || cols < 1) {
      problems.push("Matrix dimensions must be explicit positive integer rows and cols.");
    } else if (slots.length !== rows * cols) {
      problems.push(`A ${rows} by ${cols} matrix needs ${rows * cols} slots in row-major order; received ${slots.length}. Keep blank and zero slots in position.`);
    }
  }
  for (const match of text.matchAll(/\\begin\{(bmatrix|pmatrix|matrix|vmatrix|Vmatrix|Bmatrix)\}([\s\S]*?)\\end\{\1\}/g)) {
    const rows = match[2].split(/\\\\/).map(row => row.trim()).filter(Boolean).map(row => row.split("&"));
    if (!rows.length || rows.some(row => row.length !== rows[0].length)) {
      problems.push("Matrix rows have inconsistent column counts; restore the original dimensions and cell positions.");
    }
  }
  return problems;
}
