# Matrix-aware Floating Numbers and Smartboard Workflow

## Goal
Make matrices behave as first-class mathematical structures throughout the floating workflow, instead of being flattened into raw text or fragments like `and`, `bmatrix`, or loose brackets.

A matrix such as:

```text
[ 2 + 1   1 + 2 ]
[ 3 + 5   4 + 3 ]
```

must appear as a real 2 by 2 matrix in the floating preparation/generating flow and open on the Smartboard as an interactive 2 by 2 matrix activity.

## User-visible behaviour

1. **Floating preparation keeps the matrix shape**
   - A highlighted matrix stays visually recognizable as a matrix.
   - Matrix entries remain inside their correct cells.
   - The system must not split matrix content into stray words, brackets, or raw LaTeX fragments.

2. **Floating generating page treats the matrix as one branch point**
   - The main solution line numbering continues normally.
   - The matrix becomes its own branch activity, similar to tables.
   - Matrix branch labels use a separate sequence, for example `M1`, `M1.1`, `M1.2`, etc.

3. **Smartboard opens the matrix as a grid**
   - Clicking the matrix launches a 2 by 2 matrix workspace.
   - Students enter each cell independently.
   - The original bracket style is preserved where possible.
   - The matrix is not converted into a generic table visually; it should still read as a matrix.

4. **Cell-aware evaluation**
   - Each matrix cell is checked against the corresponding teacher-authored cell.
   - Completing one matrix row/track can be marked before moving to the next.
   - Evaluation must preserve coordinates, not just compare a final combined answer.

5. **No regression for tables**
   - Existing Smart Table behaviour remains intact.
   - Table labels, retained headers, row/column tracks, and immediate marking continue to work.

## Technical plan

1. **Add matrix parsing helpers**
   - Extend the floating grid helper layer with a matrix parser for LaTeX environments such as `matrix`, `pmatrix`, `bmatrix`, `Bmatrix`, `vmatrix`, and `Vmatrix`.
   - Parse rows by `\\` and columns by `&`, while respecting nested braces so expressions like fractions and roots stay intact.
   - Store matrix metadata: rows, columns, bracket/environment type, and per-cell source strings.

2. **Promote highlighted matrices to matrix grid entries**
   - In the floating generation pipeline, detect highlighted atomic matrix structures.
   - Convert them into a matrix-grid reference instead of normal text tokens.
   - Preserve the original matrix as the first visible item in the generated flow.

3. **Reuse table-activity mechanics safely**
   - Reuse the existing cell/track validation model where it fits.
   - Add a matrix-specific display mode so Smartboard rendering uses matrix brackets rather than ordinary table borders.
   - Keep table identifiers and matrix identifiers separate (`T` for table, `M` for matrix).

4. **Render matrices consistently**
   - Update floating preview/generating renderers to render matrix structures using the same math renderer used by lesson notes.
   - Avoid raw LaTeX exposure on teacher-facing pages.

5. **Verify the specific case**
   - Confirm a 2 by 2 matrix with cells `2 + 1`, `1 + 2`, `3 + 5`, `4 + 3` appears as a matrix in floating generation.
   - Confirm clicking it opens a 2 by 2 matrix activity on the Smartboard.
   - Confirm entering each cell is evaluated cell-by-cell.
