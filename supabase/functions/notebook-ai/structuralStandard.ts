// MATHGPL STRUCTURAL RENDERING STANDARD
// Distilled from docs/MathGPL Knowledge Base/Mathematical Rendering Standard/
//   MATHGPL_Structural_Rendering_Standard_FULL.docx
// Injected into every notebook-ai system prompt alongside the
// Mathematical Rendering Standard and the Benchmark Library.

export const STRUCTURAL_STANDARD = `
MATHGPL STRUCTURAL RENDERING STANDARD — every mathematical container must
automatically scale to fully contain the mathematical content it owns. No
container may remain fixed-size while its content grows.

CORE VALIDATION QUESTION (ask before display):
  "Does the container completely contain the mathematical object it owns?"
If NO → stop, resize, re-render, validate again.

FIXED SYMBOLS (no resizing): + − × ÷ = < > ≤ ≥
DYNAMIC CONTAINERS (must resize):
  parentheses, braces, square brackets, matrix borders, determinant bars,
  fraction bars, square roots, nth roots, absolute-value bars, summation Σ,
  product Π, integral ∫, limit lim, long-division roof.

RULES
  1. Parentheses must span the full height of the enclosed content (multi-row
     matrices, stacked fractions, piecewise expressions).
  2. Braces around systems of equations or piecewise functions stretch from
     the first row to the last row — no row outside the brace.
  3. Matrix borders [ ] expand to cover every row of the matrix.
  4. Determinant bars | | expand to cover every row of the determinant.
  5. Fraction bars must be at least as wide as the widest of numerator or
     denominator. Example: numerator x² + 4x + 7, denominator 2 → the bar
     spans the whole numerator, not just "2".
  6. Nested fractions — every level resizes independently; the outer bar
     covers the entire inner structure.
  7. Square roots: the root bar (vinculum) extends across the ENTIRE radicand.
     Never write \\sqrt{x^2} + 4x + 7 when you mean \\sqrt{x^2 + 4x + 7}.
  8. nth roots (³√, ⁴√, ⁿ√): same rule — bar covers the whole radicand; the
     index stays attached to the root symbol.
  9. Absolute-value bars |…| expand vertically to surround multi-row content.
 10. Summation Σ keeps its upper and lower limits attached to the operator.
 11. Product Π keeps its upper and lower limits attached.
 12. Integral ∫ keeps its upper and lower limits visually attached.
 13. Limit "lim" keeps its approaching expression (x→a, n→∞) attached below.
 14. Long division: the division roof stretches across the ENTIRE dividend,
     never shorter than the dividend.
 15. Quadratic formula: the fraction bar stretches across the entire
     numerator −b ± √(b² − 4ac); the numerator determines the width, not 2a.
 16. Multi-line equations: every container continues across every row it
     owns; mathematical relationships remain visually connected.

OUTPUT GUIDANCE
  • Always wrap radicands in braces: \\sqrt{x^2 + 4x + 7}, \\sqrt[3]{a + b}.
  • Always wrap full numerator and denominator in braces:
    \\frac{-b + \\sqrt{b^2 - 4ac}}{2a}.
  • For systems/piecewise, group rows so the renderer can size the brace.
  • For matrices, emit all rows inside a single matrix container so borders
    span the full height.
  • For absolute values around multi-row content, use the matching pair
    rather than two separate bars on different lines.

FINAL DIRECTIVE
  Mathematical containers must never be fixed-size. They must automatically
  scale to match the size of the mathematical content they contain. No
  teacher should ever see a container smaller than its content.
`.trim();
