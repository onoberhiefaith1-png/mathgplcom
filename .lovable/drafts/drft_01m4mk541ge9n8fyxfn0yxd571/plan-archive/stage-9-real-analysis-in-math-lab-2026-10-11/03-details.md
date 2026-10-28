# Technical details — Stage 9

New files, following the existing Math Lab conventions (pure engine, pure tests,
one panel, wired into the page like `OdePanel`/`ProblemsPanel`):

## Files

- `src/lib/graphApp/analysis.ts` — the whole engine, pure and on-device:
  - `sequenceTerms(src, n)` — compile a formula in `n` (shared `normalise` reader);
    returns the first n terms.
  - `convergesTo(terms)` — verdict: settling limit, divergent, or oscillating
    (detect by whether the tail's spread shrinks). Geometric/p-series/alternating
    recognition for exact statements (geometric → a/(1−r) stated exactly).
  - `partialSums(terms)` — S₁…Sₙ rows, plus the exact sum when recognised
    (geometric with |r| < 1), else a numerical ≈ estimate with a tail-bound note.
  - `epsilonN(terms, L, eps)` — the smallest N so |aₙ − L| < ε for all n ≥ N,
    or a report that no such N was found within the plotted range.
  - `epsilonDelta(f, a, eps)` — numerical limit L, then the largest δ found by
    scanning outward; the ε–δ working written in words. Also `continuityAt(f, a)`
    → defined? / limit? / do they agree?
  - `taylorCoeffs(f, x0, d)` — numerical derivatives by central differences,
    coefficients labelled ≈ (Lab convention); `taylorValue` evaluates the
    polynomial. sin/cos/exp and polynomials get a note that these match the
    classic coefficients.
  - `COUNTER_EXAMPLES` — presets: floor-type jump at 0, `sin(1/x)` near 0, each
    with its "what this disproves" text.
- `src/components/graphApp/AnalysisPanel.tsx` — right-side panel styled like
  `OdePanel.tsx`: tabs (Sequences / Series / ε–N band / ε–δ / Taylor /
  Counter-examples). Term and partial-sum plots draw in a panel SVG like the
  direction field does. The ε–N band and Taylor overlay plot onto the main 2D
  graph through the existing `onPreview`/`canvasItems` path, so nothing in
  `Graph2D.tsx` changes.
- `src/pages/graphApp/GraphAppPage.tsx` — add `"analysis"` to the panel state
  union, an "Analysis" toolbar button (Σ icon), and render the panel.
- `src/lib/graphApp/__tests__/analysis.test.ts` — one assertion per rule, exact
  values from maths, not from the code: partial sums of Σ1/2ⁿ approach 2;
  harmonic series reported divergent; ε = 0.01 for 1/2ⁿ gives a definite N;
  δ for f = 2x+1 at a = 1, ε = 0.1 is 0.05; continuity verdicts for a jump and
  for |x| at 0 (continuous, but the ε–δ still works — good teaching moment);
  Taylor of e^x at 0 degree 3 is 1 + x + x²/2 + x³/6; sin x degree 5 is
  x − x³/6 + x⁵/120.

## Verification

- Run the new tests plus the existing 51 graphApp tests; `tsgo` typecheck.
- Open Math Lab in the test browser: enter ε for a sequence, confirm the band
  and N appear; plot the sin x Taylor overlay; open the jump counter-example.
- No Smartboard, Lesson Note, Game, or credit-path code is touched.
- Limits stated in the plan: numerical derivatives and limits are labelled ≈,
  not symbolic proofs; ε–δ is found by scanning, not algebra; nothing here has
  been tested on a real phone or tablet yet.
