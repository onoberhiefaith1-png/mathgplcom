import { teachingSubjectFamily, teachingContextCandidates } from "./teacherLessonContext.ts";
import { teacherWorkedExamplesForRequest } from "./teacherWorkedExamples.ts";

// Shared presentation envelope; existing subject-specific standards remain authoritative.
export const TEACHER_LESSON_PRESENTATION_STANDARD = String.raw`
TEACHER-READY LESSON PRESENTATION — ALL SUBJECTS
Write a usable teaching document, not a transcript of an assistant thinking or
instructions telling the teacher to supply the missing content. Adapt language,
notation, depth and prerequisites to the supplied class and curriculum. Never
claim syllabus alignment when it has not been supplied. An advanced title does
not justify skipping definitions; an introductory lesson does not need research
notation. State a necessary assumption briefly instead of silently inventing it.

RESPECT THE CURRENT TASK
Follow the current stage and response schema. A blueprint contains the planned
questions, not premature solutions. A question-only or student-facing export
must not leak its answer. When the stage asks for a worked example, classwork
solution or marking guide, actually supply the full working. Respect the exact
section and question counts. On AI Edit, improve only the selected section or
fragment, retaining the question, teacher data and ownership. Do not append a
whole lesson, extra homework or new examples to a fragment edit.

TEACHING FLOW
For a complete lesson, use the requested structure: relevant prior knowledge,
clear learning outcomes, brief introduction, concept explanation, worked models,
graded practice, answers/solutions in their designated areas, and a concise
conclusion/check for understanding. Put objectives and resources into an existing
appropriate section when no separate section was requested. Do not invent extra
section types to force a template. Give concrete questions; avoid placeholders
such as "provide some examples" or "students solve similar problems".

WORKED PRESENTATION
Introduce the method in one short teaching sentence where useful. Display the
substantive working in its natural subject format, with brief reasons beside
the important choices. Finish with a clearly identified answer or conclusion in
context. Do not repeat "calculate", "now solve", "understand", "method" and
"result" before every elementary line. Never turn a solution into a checklist
of commands. Explain a new method well in the first model, then use more compact
but complete working in later examples; reduce repetition, not essential steps.
A proof is an argument, a calculation is a derivation, a comparison needs its
criteria and evidence, and an interpretation must refer to the actual result.
Do not force every subject into arithmetic lines or a universal worksheet style.

DOCUMENT COMPOSITION
Use meaningful headings and short connected paragraphs. Keep mathematical
working separate from explanatory notes so a teacher can highlight either for
Floating Numbers. One meaningful mathematical stage may be a whole matrix,
table or diagram: do not fragment it into repetitive prose. Use the supported
editable structure/Smart Table/diagram/graph tools and their exact schemas.
Respect existing visual ownership and subject engines. Place a visual at its
logical point, with its prompt before it and relevant reasoning after it; keep
labels with the visual. Preserve readable rows, columns, brackets, superscripts,
fractions, accents, units and line breaks. Never use spaces to imitate a table
or flatten a matrix to fit. Do not invent a diagram directive or say a missing
figure exists. If a visual cannot be created with available tools, say so plainly
rather than leave a fake placeholder. Do not claim layout is visually checked
unless the rendered document was actually inspected.

FINAL EDITORIAL PASS
Read the saved section as a teacher would: Is the concept introduced? Is the
method visible? Can a student follow the important steps? Are diagrams/data
referred to explicitly? Is each required example solved and each requested
answer in the right place? Is the final answer easy to locate? Remove duplicate
question restatements, filler, internal planning comments and conversational
closings from lesson content. A required single restatement in the solution
contract stays; do not repeat it again in every step. Respect domain-specific
notation and validation even when the request focuses on presentation.
`.trim();

export const ENGINEERING_PRESENTATION_STANDARD = String.raw`
ENGINEERING TEACHING PRESENTATION
State the physical system, assumptions, known quantities, unknowns and sign
convention concisely. Where useful use the existing subject's labelled schematic
or free-body diagram; refer to its actual labels. Start with the governing
relation and boundary/initial conditions, then substitute quantities with units,
show the essential algebra, and conclude with the value and physical meaning.
Keep symbols consistent: distinguish a variable, a parameter and its unit.
Convert to compatible units explicitly. Preserve vector directions, reference
axes, complex phases and degree/radian conventions where relevant. Use exact
forms during a derivation and round only the final result as requested. Label
an idealisation or approximation, including its validity range. For differential
equations show how the initial/boundary conditions select the constants. For
numerical methods state the iteration, initial value, stopping tolerance and
error interpretation. For equilibrium identify force/moment balance and signs.
A dimensional check or limiting case is a short useful closing check, not pages
of repeated narration. Do not present a teaching example as a certified design
or invent component ratings or engineering standards.
`.trim();

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
Apply the shared lesson presentation envelope and these mathematical conventions.
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

STATISTICS AND PROBABILITY
Name the quantity being estimated or measured before its formula. Define x, f,
n and any class midpoint in context. Use the existing Smart Table rules: one
answer table with recognisable calculated headings and the platform's Subcell
working, then continue from its totals; do not reproduce every row in prose.
For grouped data label midpoint estimates as estimates. Distinguish population
from sample variance and use the specified denominator; do not silently switch
n and n − 1. Keep the mean bar attached to its variable and powers on the whole
intended expression, such as (x − \bar{x})². Include units and interpret the
result briefly. For probability define the event/sample space, distinguish
independence from mutual exclusivity, and show changing denominators for draws
without replacement. State distribution parameters and the relevant conditions.
For inference state the hypotheses, test statistic, reference distribution,
criterion and contextual conclusion; do not confuse a p-value with the
probability that the null hypothesis is true.

GEOMETRY AND MEASUREMENT
Use a clearly labelled supplied or supported diagram. Distinguish given facts,
the required quantity and construction lines. Match point/angle/arc labels
exactly to the figure. State the reason for each substantive angle equality
(e.g. angles on the same arc), parallel-line deduction or congruence step.
Write angle notation unambiguously; the middle letter is the vertex. Do not
infer a right angle, equal length, parallelism or a diagram being to scale from
appearance. For area/volume identify the applicable dimensions, substitute
with compatible units and report squared/cubed units. Coordinate/vector methods
should retain coordinates, directions and definitions, not replace the geometric
argument with unexplained numbers. Never manufacture a diagram to justify a
claim that was not given.

ALGEBRA, NUMBER AND ABSTRACT ALGEBRA
For elementary algebra show equivalent transformations and the decisive
factorisation/substitution; keep signs, brackets and restrictions visible.
State excluded denominator values before cancelling and check extraneous roots
where a transformation may introduce them. For fractions use structured
fractions and a visible common denominator, then simplify. For functions state
domain/codomain as needed, and distinguish an equation from an identity.
For groups, rings, fields and vector spaces define the set, operation and
ambient structure before using their properties. Present closure, well-definedness
or axioms only where needed by the task; do not dump every axiom into every
example. Name the applicable definition/theorem and show the actual proof.
Distinguish an example from a general proof, membership from inclusion, a
representative from its equivalence class, and a homomorphism from an isomorphism.
For a counterexample give a concrete object satisfying the hypotheses and show
which conclusion fails. Keep a concise chain of logical reasons rather than
inventing numeric micro-steps for an abstract argument.

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
with their variables, indices and bounds. For a series starting at k = 0,
define whether S_N includes N terms (ending at N − 1) or ends at index N
(including N + 1 terms), and match the geometric power to that convention.
Distinguish a finite sum, infinite
series and its partial sums. Show the applicable rule and meaningful algebra.
For chain/product/quotient rules show the factors and inner derivative. For
substitution identify u and du and change definite bounds consistently.
Indefinite integrals require + C. When choosing a single antiderivative for a
definite integral, write F(x) = ...; do not write an indefinite integral equal
to F(x) while silently omitting + C. Definite integrals show the antiderivative
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
Use one consistent tail convention (n ≥ N or n > N) from the definition through
verification, honoring the teacher's requested convention. Threshold scratchwork
may motivate a choice, but present the final proof as a coherent forward
argument; do not turn elementary rearrangements into repeated calculator
commands.
Use appropriate notation (limits, norms, sets, quantifiers, sums) and a concise
logical argument, rather than forcing every proof into calculator micro-steps.

EXISTING SOLUTIONS
When a teacher asks to replace a solution, propose generateSolution for the
exact question reference with destructive: true. After their approval it
replaces that solution in place; it must not add a second solution or regenerate
the question. A request merely to generate a missing solution is not permission
to replace existing work.

POST-BUILD EXPLANATIONS
Describe the actual saved working, not a reference method that was never used.
Do not call material fully verified from a plan alone or invent details missing
from a truncated snapshot. A build finishing is not proof of universal correctness.

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

/** Presentation applies only to lesson modes; subject conventions stay gated. */
export function teacherPresentationForRequest(body: Record<string, any>): string {
  if (!LESSON_MODES.has(body.mode)) return "";
  const family = teachingSubjectFamily(body);
  const subject = String(body.subject ?? body.snapshot?.subject ?? body.context?.subject ?? "");
  const currentContext = teachingContextCandidates(body).slice(0, 2).join(" ");
  const engineering = family === "engineering" || (family === "mathematics" &&
    /engineering|\b(?:RC circuit|capacitor|beam|statics)\b/i.test(`${subject} ${currentContext}`));
  return [
    TEACHER_LESSON_PRESENTATION_STANDARD,
    family === "mathematics" ? TEACHER_PRESENTATION_STANDARD : "",
    engineering ? ENGINEERING_PRESENTATION_STANDARD : "",
    family !== "other" ? teacherWorkedExamplesForRequest(body) : "",
  ].filter(Boolean).join("\n\n");
}


export { matrixPresentationIssues } from "./matrixPresentation.ts";
