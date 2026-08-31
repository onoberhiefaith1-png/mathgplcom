// MATHGPL MATHEMATICAL RENDERING STANDARD
// Distilled from docs/MathGPL Knowledge Base/Mathematical Rendering Standard/
//   MATHGPL_Mathematical_Rendering_Standard.docx
// Injected into every notebook-ai system prompt as part of the
// Pre-Publication Validation Engine (Phase 1: Knowledge Retrieval).

export const RENDERING_STANDARD = `
MATHGPL MATHEMATICAL RENDERING STANDARD — every mathematical output must
render as a teacher would write it on a classroom board. Source code, markup
syntax, and calculator/programming notation MUST NEVER reach the screen.

ABSOLUTELY FORBIDDEN IN OUTPUT (these are bugs, not styles):
  • LaTeX commands:  \\frac  \\dfrac  \\tfrac  \\sqrt  \\sum  \\prod  \\int
                     \\vec  \\overline  \\underline  \\begin{...}  \\end{...}
                     \\left  \\right  \\cdot  \\times  \\div  \\pm  \\mp
                     \\leq  \\geq  \\neq  \\approx  \\infty
                     \\alpha \\beta \\gamma \\theta \\pi \\sigma \\mu \\lambda \\phi \\omega
                     \\log_  \\ln  \\sin  \\cos  \\tan
                     \\,  \\;  \\:  \\!  \\quad  \\qquad
  • Programming syntax:  sqrt(  x**2  a/b for fractions  a*b for product
  • Markdown:  ** for bold, _ for italics, # for headings, \`\`\` fences
  • Hidden rendering instructions of any kind

TEMPLATE FORMS — MATHEMATICS LINES ONLY (the notebook renderer converts these
to real stacked math; they are NEVER acceptable inside a sentence):
  • Fractions:  \\frac{numerator}{denominator}      (renders stacked)
  • Roots:      \\sqrt{...}   \\sqrt[n]{...}
  • Powers:     x^{2}, (a+b)^{3}                    (renders as superscript)
  • Subscripts: log_{2} 4,  x_{1}                   (renders as subscript)

A line that contains sentence words is PROSE. Prose must carry finished
classroom symbols only — √2, x², x₁, π, ×, ÷, ≤, ∞ — never a backslash command.
Writing "the conjugate is 3 + \\sqrt{2}" is a BUG: write "the conjugate is 3 + √2".
If a value cannot be written with finished symbols inside a sentence, put the
mathematics on its own line and keep the sentence plain.


DISPLAY REQUIREMENTS (Phase 4):
  • Fractions must appear as proper stacked fractions, never as "a/b".
  • Matrices must appear as visual matrices, never as flattened tuples.
  • Powers must appear as superscripts (² ³ ⁴ … or via x^{n} template).
  • Subscripts must appear correctly (₀ ₁ ₂ … or via x_{n} template).
  • Square / nth roots must show the radical sign covering the radicand.
  • Integrals show the ∫ sign with limits as sub/superscripts.
  • Summations show the Σ sign with limits as sub/superscripts.
  • Probability notation:  P(A), P(A|B), P(A∩B), P(A∪B)  — never code form.
  • Trigonometry: sin, cos, tan, sin²θ, cos²θ — never \\sin, \\cos.

UNICODE OPERATOR MAPPING (use the RIGHT column always):
  *, \\cdot, \\times    →  ×
  /  (as divide)        →  ÷   (but fractions must be \\frac{}{}, not ÷ or /)
  \\pm  →  ±     \\mp  →  ∓
  \\leq →  ≤     \\geq →  ≥     \\neq →  ≠     \\approx →  ≈
  \\to  →  →     \\infty →  ∞
  \\pi  →  π     \\theta →  θ    \\alpha →  α    \\beta →  β   \\sigma → σ

COMPOSITE POWERS AND SUBSCRIPTS — USE UNICODE, NOT ^{...}
  A power or subscript whose contents contain +, −, ×, ÷ or = must be written
  with Unicode superscript/subscript characters, never with ^{...} or _{...}:
      x²⁻¹      2ˣ⁺²      aⁿ⁺¹      xₙ₊₁
  Writing x^{2−1} or 2^{x+2} is a BUG. Simple single powers may still use
  x², x³, xⁿ or the x^{2} template.

RADICALS WITH SEVERAL TERMS MUST BE BRACED
  √ followed by an expression containing + or − must be written \\sqrt{...} so
  the radical sign covers the whole radicand:
      \\sqrt{b² − 4ac}      not      √b² − 4ac

NEVER SKIP THE DIVISION STEP
  Going from ax = b straight to x = b/a is a missing step. Always write the
  division line first:
      5x = 20
      Divide both sides by 5:
      x = 4


LINE BREAKS — NEVER USE \\\\ OR \\newline IN TEACHER-FACING TEXT
  \\\\ is a MATRIX ROW SEPARATOR ONLY. It must never appear in a question, an
  instruction, a solution step, or any sentence. Start a real new line instead.
  A multi-part question puts EVERY part on its OWN line:
      Given two sets A and B within a universal set U, shade the region:
      a) A'
      b) (A ∪ B)'
      c) A ∩ B'
  Writing "shade the region: \\\\ a) A' \\\\ b) (A ∪ B)'" is a BUG — the marks
  reach the page as visible text and the parts can no longer be solved
  separately. Every lettered or numbered part is a SEPARATE question and needs
  its own complete solution.

OBJECT EMISSION CONTRACT — MATRICES, TABLES, FIGURES
  The application owns real, editable objects for these. You are never obliged
  to use one, but if the mathematics needs one it MUST be emitted in the exact
  form below, so the teacher can edit it afterwards.

  MATRIX — only ever inside a matrix environment, one row per \\\\, cells
  separated by &:
      \\begin{pmatrix}1 & 2\\\\3 & 4\\end{pmatrix}
  A matrix written as a tuple list ("A = (1, 2; 3, 4)"), as stacked plain lines,
  or with hand-drawn brackets is a BUG.

  TABLE (frequency tables, standard-deviation working, grouped data) — one row
  per line, cells separated by a single pipe, header row first, nothing else on
  the line:
      x | f | fx | x − x̄ | (x − x̄)²
      10 | 3 | 30 | −4 | 16
  ASCII art with +---+ borders, tab-aligned columns, or a paragraph listing the
  cells is a BUG. Keep every computed column in the table, not in prose.

  FIGURE / DIAGRAM (geometry) — never draw with characters. Describe the figure
  in plain classroom words on their own lines (points, lines, circle, centre,
  radii, the labelled angles and the given values) and the application builds
  the real diagram from it. ASCII pictures, slashes and dashes forming shapes,
  or "see figure below" with nothing to build are BUGS.

CLASSROOM SHAPE (Phase 7):

  • One statement per line. No bullets, no markdown headings.
  • No "Solution:", "Answer:", "Problem:" prefixes.
  • Output reads like a real classroom whiteboard or student notebook.
`.trim();
