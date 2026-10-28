# Stage 9 — Real analysis in Math Lab

The fifth panel in the teacher workspace's Math Lab, built the same way as the
others: one pure maths engine file, one panel component, pure tests. No AI, no
credits, nothing on the Smartboard or Lesson Notes changes.

## What gets built

A new "Analysis" tool in Math Lab with five tabs:

1. **Sequences** — type a formula in n (for example `1/2^n` or `(-1)^n/n`) and
   see the first N terms plotted as dots. A convergence verdict is written out:
   does the sequence settle, and to what limit?
2. **Series (partial sums)** — the same formula as a series Σ aₙ. Every partial
   sum S₁, S₂, S₃ … is plotted and listed in a table, and the engine reports
   convergence (geometric with |r| < 1 → a/(1−r); p-series; alternating; the
   harmonic series is shown diverging). Known exact sums are stated exactly;
   others are labelled ≈.
3. **Limits — pick ε, see N.** For a convergent sequence and a limit L, the
   teacher drags an ε slider; the graph draws the band L ± ε and the panel
   names the smallest N so that every term from N onward stays inside the band.
   This is the ε–N definition made visible.
4. **Limits — ε–δ and continuity.** For a function f and a point a: type ε,
   the engine finds δ numerically (scan outward until |f(x) − L| ≥ ε) and
   states the ε–δ working in words. It also gives a continuity verdict at a:
   is f(a) defined, does the limit exist, and do they agree? A slider walks
   through "for every ε there is a δ" by showing the band and the resulting
   interval around a.
5. **Taylor polynomials** — type a function, choose the centre x₀ and degree d;
   the polynomial is built (numerical derivatives, labelled ≈ like all numerical
   work in the Lab) and drawn hugging the real curve, with a slider to raise the
   degree. One click overlays it on the main 2D graph.
6. **Counter-examples** — preset buttons: a jump discontinuity (floor-type
   function), and sin(1/x) oscillating without settling near 0. Each opens with
   a written note of what it disproves, so the picture teaches the idea.

## Significance (per the approved roadmap)

- **Teachers** can show university-style rigour as a picture: set ε, watch N or
  δ appear, and see a proof idea instead of reciting symbols.
- **Students** learn when a picture is enough and when proof takes over; they
  watch partial sums creep toward a limit and a Taylor polynomial hug sin x
  before bending away.
- **Real-world purpose:** how calculators actually compute sin x (Taylor
  series), and how much error any approximation carries.
- **Why it beats paper:** a chalkboard draws one frozen ε; the Lab lets the
  student move ε themselves and see N change — that is the definition, felt.
