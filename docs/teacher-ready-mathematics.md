# Teacher-ready mathematics presentation

This draft improves prompting and structural conversion. It does not fine-tune
or retrain the underlying model and does not establish correctness across all
mathematics.

## Behavior

Maths lesson generation, MathEngine, Copilot planning, selection AI Edit,
blueprinting and review receive the same final presentation policy. The request's
subject and curriculum level remain authoritative. Physics/Chemistry retain
their subject-specific standards. Floating-token extraction and marking protocols
receive no additional lesson-layout instructions.

Matrices use shaped, editable objects: operands, one matrix of row-column sums,
and the simplified result. General indexed notation remains appropriate for a
general rule; repetitive per-entry narration is unnecessary for a routine product.
Trigonometry must retain domains, angle units and complete solution sets;
calculus must retain operators, limits, bounds, constants and justified rules;
analysis must retain assumptions, quantifiers and logical proof steps.

Server normalization now protects entire matrix environments, not merely their
begin/end commands. Otherwise its spacing cleanup destroys row delimiters before
the client creates the editable matrix. Native structure slots preserve leading,
interior and trailing blanks. Shape checks feed existing bounded workspace repair
and MathEngine retries; final generation/AI Edit/solution gates return 422 for
remaining malformed matrices instead of saving a distorted object.

Server and client hygiene preserve mathematical commands such as theta, to,
norm and nabla while decoding standalone escape residue.

## Validation completed

199 tests across teacher presentation, server-to-editor conversion, editable AI
structures, mathematical tokens, row separators, Smart Tables, and existing Physics/Chemistry behavior.
Coverage includes 2x2, 3x3, 2x3 and genuine 1x7 matrices; exact row-major values;
blank slots; fractions/powers; nine parallel dot products; malformed native and
ragged legacy matrices; advanced notation; and subject/mode boundaries.

The pure server standards/helpers, client solution contract, AI target resolver
and action contract also pass a targeted strict TypeScript check.
The request handler, DocumentEditor and Copilot conversation integration are
syntax-checked separately; this is not a full application build.
These are deterministic regression tests, not ratings of newly generated lessons.

## Sample library and runtime corrections

Nine reviewed references cover matrix multiplication, all trig solutions,
chain-rule differentiation, definite integration, finite summation, infinite
geometric series, epsilon-N convergence, epsilon-delta continuity and a
pointwise-versus-uniform counterexample. Only relevant references are selected
(up to two); the editor's activeSubtopic overrides a broad notebook title.
Greeting and floating/marking requests do not receive the worked references.
Notebook subjects are forwarded through Math Engine, blueprint and plugin
planning requests so Maths guidance does not leak into Physics/Chemistry.
These examples persist in code; they are not model-weight fine-tuning.

The plugin save contract now understands native structure attributes, multi-line
question restatements, matrix introductions, sum bounds and conditional proof
steps. It retains original-question checks and refuses unrelated merged equations.

Snapshots read only the body after a Solution heading, so an empty placeholder
is not mistaken for existing worked content. Detached solutions are resolved by
their owning question instead of whichever section contains their current offset.

An async editor guard resolves the same section/solution owner after awaited
stages instead of trusting a stale document offset. Deleted/ambiguous targets
are refused. This guards against misplaced output; the exact live placement
failure still needs an end-to-end test on the updated application.

Approved solution replacement now passes an explicit replacement flag through
the editor bridge. Ordinary generateSolution still refuses duplicate work;
replacement requires destructive intent and actual approval. It regenerates
only that question's existing Solution area. The question is not regenerated.

Explicit legacy matrix tags, bracketed sum bounds and bracketed limit notation
are normalized using their supplied data, without inventing dimensions or bounds.
The server/client use the same pure legacy sum/limit normalization helper.

## Actual generator evaluation — 29 October 2026

The original two plugin generation requests timed out and saved no generated
content in their separate QA note. This remains an unresolved plugin-request
verification issue; the deterministic contract repairs are not proof that the
service timeout itself is fixed.

Direct website testing succeeded in the active teacher workspace. The unassigned
QA notebook is /lesson-notes/535abef8-4851-4d23-8e0f-6c86a9bc8e4b.
The current live backend was tested using explicit teaching instructions; the
draft code has NOT been deployed. These runs are baseline/evaluation evidence,
not certification of the new deployment.

| Probe | Independently reviewed mathematics | Presentation/integration finding |
| --- | --- | --- |
| 2x2 product A=(2,1;0,3), B=(1,4;2,0) | AB=(4,8;6,0); all four dot products shown together | Saved matrices became 1x3 objects and the question exposed [matrix ...] shorthand. Actual failures are regression fixtures. |
| 2 cos²θ − 3 cos θ + 1 = 0, 0° ≤ θ < 360° | Complete set 0°, 60°, 300°; factorisation and boundary exclusion correct | Excess mechanical narration; working appeared above the Solution heading, leaving its intended area empty. |
| y=(2x³−1)⁵ | Derivative 30x²(2x³−1)⁴, including the inner derivative | Correct working, but repetitive instructions and inline derivative typography need refinement. |
| Integral of 3x² from 0 to 2 | Correct exact value 8 and upper-minus-lower evaluation | An intermediate displayed indefinite integral omitted + C. Guidance now distinguishes an indefinite integral from choosing F(x). |
| 3/(n+2) tends to zero | Valid proof choosing positive integer N ≥ 3/ε−2 and verifying for n>N | Long backward scratchwork; the n>N convention is valid but differs from the requested n≥N. Closing chat describes a different bound from the saved proof. |
| Sum from k=0 to infinity of (1/2)^k | First term 1, ratio 1/2, convergence checked, partial sum of N terms 2(1−(1/2)^N), limit 2 | Mathematical result correct; visible bracketed sum/limit source and repetitive narration remain on the old live version. |
| Targeted proof revision | Requested a concise forward Archimedean proof with n≥N | Copilot proposed the right replacement, but after approval the existing-solution guard refused it. No revised proof was saved. The draft repairs this action path. |

Numerical spot checks of reference answers supplement human mathematical review;
they are not formal proof verification. Renderer tests verify sigma, fractions,
cases and explicit bounds remain mathematical notation rather than raw source.
No existing teacher lesson was replaced and nothing was assigned to students.

## Release and evaluation procedure

1. Review this draft and the reference examples below. Preserve the user's draft
   approval workflow before merging or releasing.
2. Deploy notebook-ai with teacherPresentation.ts, teacherWorkedExamples.ts,
   matrixPresentation.ts and legacyNotation.ts. Build the client changes and
   regenerate/deploy the MCP bundle from its source to update the plugin save
   contract. Do not edit the generated MCP bundle manually. A frontend-only
   publication is insufficient to update server prompts or plugin behavior.
   Confirm the deployed notebook-ai response header X-MathGPL-Notebook-Build is
   teacher-ready-2026-10-29-v1; repository sync alone is not deployment proof.
3. Generate fresh examples in a separate QA note through actual Copilot and AI
   Edit for each topic; inspect saved node dimensions and the visible preview.
4. Evaluate correctness, conventional notation, completeness, teaching clarity,
   and editable/floating compatibility separately. Record the actual output,
   defects and revised prompt before another bounded iteration.
5. Re-run the QA replacement and moved-heading cases in the updated editor.
   Confirm all generated working is inside its intended Solution area.
   Exercise existing geometry/algebra/statistics examples and Physics/Chemistry
   for regressions. Do not claim all mathematics verified from four examples.
6. Previously flattened saved matrices need review against their original source;
   never guess their dimensions or silently rewrite an existing lesson.

## Reference examples for review

The following are authored acceptance references, not model-generated outputs.

### Matrix multiplication

Use row times column. Keep the four calculations in their matrix positions:

\[
A=\begin{bmatrix}1&2\\3&4\end{bmatrix},\qquad
B=\begin{bmatrix}5&6\\7&8\end{bmatrix}
\]
\[
AB=\begin{bmatrix}1(5)+2(7)&1(6)+2(8)\\3(5)+4(7)&3(6)+4(8)\end{bmatrix}
=\begin{bmatrix}19&22\\43&50\end{bmatrix}.
\]

### Trigonometry

Solve sin(2θ) = sin θ for 0° ≤ θ < 360°.

\[
2\sin\theta\cos\theta-\sin\theta=0
\]
\[
\sin\theta(2\cos\theta-1)=0
\]
Thus sin θ = 0 or cos θ = ½. In the given interval,
θ = 0°, 60°, 180°, 300°. Do not divide by sin θ and lose two solutions.

### Calculus

For y = (3x² + 1)⁴, apply the chain rule:

\[
\frac{dy}{dx}=4(3x^2+1)^3(6x)=24x(3x^2+1)^3.
\]

For the definite integral, show upper minus lower:

\[
\int_0^1 3x^2\,dx=[x^3]_0^1=1^3-0^3=1.
\]

The corresponding indefinite integral is x³ + C.

### Real analysis

Prove that 1/n tends to 0. Let ε > 0. Choose an integer N > 1/ε.
For every integer n ≥ N,

\[
\left|\frac1n-0\right|=\frac1n\le\frac1N<\varepsilon.
\]

Hence 1/n → 0 by the definition of sequence convergence. The choice of N and
the universal bound are essential; a list of numerical values is not a proof.
