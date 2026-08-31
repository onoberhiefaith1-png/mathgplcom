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

CLASSROOM SHAPE (Phase 7):
  • One statement per line. No bullets, no markdown headings.
  • No "Solution:", "Answer:", "Problem:" prefixes.
  • Output reads like a real classroom whiteboard or student notebook.
`.trim();
