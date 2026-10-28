## Technical notes

**New files**
- `src/lib/lessonnotes/matrixQuick.ts` — the model: dimension list, operation and special-type ids, a `compatibility(selection)` function returning which chips are enabled plus a disable reason, a human preview string, and `buildQuickMatrixLatex(selection)` producing the LaTeX to insert.
- `src/components/lessonnotes/MatrixQuickPanel.tsx` — the popover palette (shadcn `Popover`, same pattern as `MathSymbolPanel`), compact chips, live preview line, `Enter` button, Enter/Escape key handling.

**Wiring**
- `DocumentEditor.tsx`: render `<MatrixQuickPanel insertMath={insertMathStructure} />` in the ribbon beside `MathSymbolPanel`, near the top of the math tools. No changes to `MatrixCreateDialog`, `matrixFunctions.ts`, `MathAssetPicker`, or the Asset Library route.

**Insertion format**
Reuse the existing `mathInline` + LaTeX path (`insertMathStructure`), which already parses `\begin{pmatrix|bmatrix|vmatrix|Vmatrix|Bmatrix}` with `&` / `\\` and renders `\sl{}` as an editable placeholder cell (`src/lib/notebook/mathRender.ts`). So:
- dimension → exactly `rows` groups of `cols` cells, in that order (no transposition anywhere);
- Determinant → `vmatrix` environment; other cases → `pmatrix`;
- Transpose → trailing `^{T}`, Inverse → `^{-1}`, Adjoint → literal `adj` prefix, Determinant already carried by the fence;
- Identity → 1/0 literals; Zero → all `0`; Diagonal → `\sl{}` on the diagonal, `0` elsewhere; Scalar → same diagonal cell repeated with `0` elsewhere; Row/Column → 1×n / n×1.

**Compatibility table** (single source of truth in `matrixQuick.ts`, consumed by both the disabled state and the builder, so no invalid selection can reach insertion): square-only = determinant, inverse, adjoint, identity, diagonal, scalar; any-shape = transpose, zero; shape-forcing = row (1×n), column (n×1); at most one special type; operations stack in click order.

**Checks**: unit test `buildQuickMatrixLatex` for 2×3 vs 3×2 row/column counts and for each operation wrapper; a Playwright pass inserting two 3×3 matrices around a `+` to confirm repeated fast insertion and that the existing Matrix builder still opens from the Asset Library.
