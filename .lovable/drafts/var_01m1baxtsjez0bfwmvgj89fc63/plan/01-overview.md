# Lesson notes: no empty fraction bars, real diagrams/tables/matrices, readable inventory

Three defects to fix, then a live training sweep of ten lesson notes across the
topics you named.

## 1. The empty fraction bar

In the screenshot the line reads `rac140°2 = ▭ × ∠ABC2`: the word `frac` lost its
first character and an empty fraction shell was drawn beside the leftover digits.
Two causes, both confirmed in the code:

- The AI text arrives with a control character where `\frac` should be (the `\f`
  escape got interpreted), so the macro name is destroyed before any math parser
  sees it. Nothing currently restores it.
- When a fraction cannot be read, the display gate deliberately substitutes an
  empty editable slot (`\frac{\sl{}}{\sl{}}`). That is right when a teacher is
  typing, but wrong for generated content — it is the empty bar you are seeing.

Fix: restore mangled macro names before conversion, and in generated content drop
an unreadable fraction/root entirely (keep the surrounding words) instead of
drawing an empty shell. An empty bar must never reach the page.

## 2. Diagrams, tables and matrices must be real objects

The AI is not obliged to use them — but when a question or solution needs one, it
must arrive as the system's own object, fully editable:

- a geometry question with a figure → a diagram node in the diagram editor
- a statistics question with a frequency/standard-deviation table → a real
  Mathematical Table object with editable cells
- matrix work → a matrix object with proper rows and brackets, never a flattened
  tuple or a `\\` separated line

3D stays out of scope — the teacher builds those.

## 3. The lesson inventory text

The build checklist ("Introduction, Explanation, Example 1 …") uses theme ink
while the Co-Pilot panel is a fixed light surface, so on a dark theme the labels
turn near-white on white — the blur you see. The checklist switches to the same
solid dark ink the rest of that panel already uses, at every state.

## 4. Training sweep — ten lesson notes

One introduction, one explanation, four examples, four exercises, four homework,
conclusion, each question individually sectioned and fully solved:

1–4. Geometry with diagrams: circle theorems, angles in polygons, similar
triangles with a figure, bearings with a sketch.
5. Matrices: multiplication, determinant, inverse, simultaneous equations.
6–7. Statistics with tables: standard deviation from a frequency table; mean and
grouped-data variance.
8. Complex numbers: modulus, argument, conjugate, division.
9. Partial fractions.
10. Surds, indices and logarithms.

Each round is inspected for: empty fraction bars, raw syntax, visible `\\`,
missing Solution headings, grouped questions, and whether diagrams/tables/matrices
came out as editable objects. Every defect found is fixed in the standards or the
converters, then the round is regenerated until the topics come back clean.
