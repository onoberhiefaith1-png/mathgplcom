# Matrix quick-access palette

A new **Matrix** button joins the lesson-note ribbon next to Emojis and the symbol panel. It opens a compact popover palette — not a page, not a full modal — where the teacher picks a dimension, optionally an operation or special type, then presses **Enter** to drop the matrix at the cursor.

The existing Matrix builder (Asset Library → dimension → bracket → functions → Create) stays exactly as it is. Nothing about it is removed or rewired; the palette is a second, faster door.

## The palette

One panel, three bands that belong together, one Enter:

- **Matrix** — 2×2, 2×3, 3×2, 3×3, 3×4, 4×3, 4×4, 4×5, 5×4 as small chips
- **Matrix operations** — Transpose, Determinant, Inverse, Adjoint
- **Special matrices** — Identity, Zero, Diagonal, Scalar, Row, Column
- A live preview line showing the pending combination, e.g. "Inverse of a 3 × 3 matrix"
- **Enter** (and the Enter key) inserts; nothing is inserted on individual clicks

## Combination rules

Selections combine instead of replacing each other. Incompatible options are visibly disabled with a reason on hover, so an invalid combination cannot be built:

- Determinant, Inverse, Adjoint, Identity, Diagonal, Scalar require a **square** dimension — with 2×3 chosen they are disabled; choosing one of them from a non-square state disables the non-square chips.
- Transpose and Zero accept any dimension.
- Row forces 1 × n, Column forces n × 1, and both then disable the square-only options.
- Only one special type at a time; operations may stack in the order clicked (e.g. Diagonal + Inverse → inverse of a 4 × 4 diagonal matrix).
- Changing the dimension keeps compatible selections and drops the ones that no longer apply.

## What gets inserted

The same kind of inline math object the symbol panel already inserts, so the teacher types straight into the cells and keeps writing the equation. Dimensions are preserved literally — 2×3 is two rows of three, 3×2 is three rows of two — and travel unchanged into Smartboard, Floating and the student view because they use the same math object.

Empty cells are editable placeholders, except where mathematics fixes them: Identity fills 1s and 0s, Zero fills 0s, Diagonal and Scalar leave off-diagonal 0s with editable diagonal cells.
