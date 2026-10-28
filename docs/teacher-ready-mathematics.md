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

115 tests across teacher presentation, server-to-editor conversion, editable AI
structures, mathematical tokens, row separators, Smart Tables, and existing Physics/Chemistry behavior.
Coverage includes 2x2, 3x3, 2x3 and genuine 1x7 matrices; exact row-major values;
blank slots; fractions/powers; nine parallel dot products; malformed native and
ragged legacy matrices; advanced notation; and subject/mode boundaries.

The five pure server modules also pass a targeted strict TypeScript check.
The large request handler is syntax-checked separately; this is not a full app build.
These are deterministic regression tests, not ratings of newly generated lessons.

## Live generator evaluation — incomplete

A separate, unassigned notebook named “QA — Teacher-style mathematics review
(draft)” was created for testing. The normal lesson-content generator was called
first for a 3x3 question and then for a smaller 2x2 solution with explicit
textbook-style instructions. Both requests timed out at the MCP service. The
readbacks confirmed that neither generated question nor generated solution was
saved. The 2x2 QA question itself was inserted as a test input.
No existing teacher lesson was replaced and nothing was assigned to students.

The new server policy has NOT been deployed. Prompted live probes use the current
backend with explicit instructions; they are not evidence that this draft is live.
Do not mark model-quality evaluation complete on the strength of fixture tests.

## Release and evaluation procedure

1. Review this draft and the reference examples below. Preserve the user's draft
   approval workflow before merging or releasing.
2. Deploy the updated notebook-ai function with its new teacherPresentation.ts
   dependency, and build/publish the client conversion change. A frontend-only
   publication is insufficient to update the server prompt.
3. Generate fresh examples in a separate QA note through actual Copilot and AI
   Edit for each topic; inspect saved node dimensions and the visible preview.
4. Evaluate correctness, conventional notation, completeness, teaching clarity,
   and editable/floating compatibility separately. Record the actual output,
   defects and revised prompt before another bounded iteration.
5. Exercise existing geometry/algebra/statistics examples and Physics/Chemistry
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
