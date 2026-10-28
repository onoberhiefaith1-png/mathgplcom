# Matrix Builder — notation-only expression builder

Rework the existing Matrix asset into a single, guided builder: choose dimension, choose bracket, choose function(s), create. The inserted object is one mathematical expression with placeholder cells the teacher fills in. Nothing is ever calculated, and the long matrix settings toolbar goes away.

## 1. Creation flow (one dialog, four steps)

Replace the current small matrix dialog with a stepped builder used by both the Asset Library and the `@` menu:

- **Dimension** — Rows and Columns fields showing placeholder text ("rows", "cols") until the teacher types. Any size (1–20). The grid is created with exactly that many cells; placeholder words never enter the document.
- **Bracket** — `( )`, `[ ]`, `{ }`, `| |`. No auto-choice, no bracket implied by a function.
- **Functions** — multi-select chips, selected ones visibly active: Transpose, Inverse, Determinant, Adjoint, Conjugate, Conjugate Transpose, Trace, Rank, Norm, Matrix Power. Matrix Power adds an empty exponent placeholder the teacher types into (n, 5, k…). No Identity/Zero here.
- **Create** — live preview of the exact expression is shown above the buttons, then the object is inserted at the cursor with the caret in the first cell.

Existing separate assets (column vector, row vector, identity, augmented) stay as they are — untouched.

## 2. Brackets grow with the matrix

Brackets stop being fixed-size text glyphs. They are drawn from the measured height/rows of the cell grid so a 2×2, 3×3 or 3×4 matrix each gets brackets of the correct height (and correct curvature for parentheses/braces), scaling as one piece with the structure, never stretched as an image.

## 3. Placeholder cells

Every cell starts as an empty slot rendered as a faint `□`. Typing a value replaces it; the placeholder is presentation only and is never part of the expression, the saved note, or anything sent to the AI.

## 4. How several functions merge into one expression

The functions are notation modifiers on **one** object — never separate matrices. They combine in a fixed hierarchy:

```text
outer function ( bracketed matrix  superscript modifiers )
```

- Superscript layer (attached, stacked in selection order): Transpose `ᵀ`, Inverse `⁻¹`, Conjugate Transpose `ᴴ`, Matrix Power `^□`
- Overline layer: Conjugate (bar drawn over the bracketed matrix)
- Prefix/outer layer: `det`, `adj`, `tr`, `rank`, and Norm as `‖ … ‖` around the whole bracketed matrix

So Transpose + Inverse + Determinant renders as `det( (matrix)⁻¹ )ᵀ`-style combined notation — one object, one selection, superscripts locked to the matrix and unable to drift away as loose text. Determinant never overrides the teacher's bracket choice: `det[ … ]`, `det( … )`, `| … |` all remain possible because the bracket comes from step 2.

## 5. No calculation, ever

Selecting Determinant, Trace, Rank, Norm, Inverse, Adjoint or Power only builds notation. No expansion, no evaluation, no auto-simplification anywhere in the pipeline.

## 6. Smartboard

The long matrix settings/control line is removed. On the board the matrix arrives fully configured; the teacher only enters values and works with it. The board's structure menu gets one "Matrix" entry that opens the same builder (replacing the fixed 2×2 / 3×3 / determinant chips), and board matrices render with the same growing brackets, functions and superscripts.

## Technical notes

- `src/components/lessonnotes/MatrixCreateDialog.tsx` → rewritten as a stepped `MatrixBuilderDialog` returning `{ rows, cols, br, fns[], power?, divider? }`; wiring in `AssetLibraryDialog.tsx` and `AtCommandMenu.tsx` updated to the new result shape.
- `src/lib/lessonnotes/assets/structures.ts` / `types.ts`: the `matrix` asset carries the new dialog result; slot count = `rows*cols` (+1 when Matrix Power is chosen, for the exponent slot).
- `src/components/lessonnotes/extensions/MathStructure.tsx`: matrix branch renders prefix (`det`/`adj`/`tr`/`rank`/norm bars), measured stretchy brackets (SVG/scaled glyph instead of the `::before`/`::after` characters in `src/styles.css`), the cell grid, conjugate overline, and the superscript group (with the exponent as a real editable slot).
- `src/lib/lessonnotes/structureValidator.ts`: slot-count rule updated for the extra power slot so repair doesn't drop it.
- `src/components/lessonnotes/MatrixToolbar.tsx` removed from `DocumentEditor.tsx` and deleted; `src/lib/lessonnotes/matrixOps.ts` keeps only the pure helpers still referenced.
- Smartboard: `src/lib/smartboard/mathTree.ts` matrix node gains `fns`/`power`; `MathTreeRender.tsx` MatrixView renders prefix/superscript/overline with height-measured brackets; `boardStructures.ts` collapses `mat2`/`mat3`/`det2` into one builder-backed Matrix entry, plus LaTeX/ASCII serialisers in `mathTreeLatex.ts` and `rowAscii.ts` extended for the new modifiers.
