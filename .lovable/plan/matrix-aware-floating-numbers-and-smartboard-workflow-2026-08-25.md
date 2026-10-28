# Matrix-aware Floating Numbers and Smartboard workflow

## Goal
When a solution contains a matrix, Floating Generating must treat it as a matrix structure, not as raw text or a normal bracket expression. A 2 by 2 matrix such as:

```text
\begin{bmatrix}
2 + 1 & 1 + 2 \\
3 + 5 & 4 + 3
\end{bmatrix}
```

should appear as one matrix item first, then open on the Smartboard as a 2 by 2 editable matrix where each cell can be answered and marked in sequence.

## What will change

1. **Matrix parsing**
   - Add a matrix parser that recognises LaTeX matrix environments such as `bmatrix`, `pmatrix`, `matrix`, `vmatrix`, `Vmatrix`, and `cases`.
   - Split matrix content into rows with `\\` and cells with `&`, while preserving nested maths inside each cell.
   - Store the result as a rectangular grid with the original bracket style retained.

2. **Floating Generating page**
   - Before treating a highlighted item as a text line, detect whether it is a matrix.
   - Promote matrix highlights into grid workspaces, the same way tables become workspaces.
   - Keep the matrix as the first line/item when it appears first in the solution.
   - Generate matrix child lines per row or column, without turning `bmatrix` into visible raw text.

3. **Numbering and navigation**
   - Keep table branches as `T1`, `T1.1`, `T1.2`, etc.
   - Add matrix branches as `M1`, `M1.1`, `M1.2`, etc.
   - At the end of a matrix branch, “Next” returns to the next main solution line, just like table branches do.

4. **Smartboard rendering**
   - A matrix chip opens an interactive matrix panel, not a plain table.
   - Render matrix brackets visually: square brackets for `bmatrix`, parentheses for `pmatrix`, vertical bars for `vmatrix`, etc.
   - Reuse the existing table cell editor, shortcut keys, per-cell validation, and immediate row/column marking.

5. **Persistence**
   - Save matrix metadata with the floating lines so reopening the lesson restores the same matrix workspace.
   - Keep the original matrix dimensions, values, label, and bracket style.

## Technical notes

- `src/lib/floating/tableGrid.ts` will get a `gridFromMatrixLatex` helper and matrix metadata on the grid model.
- `src/lib/lessonnotes/floatingCompile.ts` will carry matrix metadata through `FloatingTableRef`.
- `src/pages/FloatingNumbersPage.tsx` will promote matrix payloads into table-style entries before normal text handling.
- `src/lib/smartboard/tableActivity.ts` will support `M` prefixes alongside `T` prefixes.
- `src/components/smartboard/TableActivityStage.tsx` will render a matrix visual mode using the existing cell interaction engine.
- `src/components/smartboard/FloatingNumberPanel.tsx` will show matrix chips distinctly from table chips.

## Validation

- Add tests for parsing 2 by 2 and larger matrices.
- Add tests confirming matrix numbering uses `M` labels and does not affect the main `L` sequence.
- Verify that matrix cells containing expressions like `2 + 1`, `1 + 2`, `3 + 5`, and `4 + 3` remain intact and editable.
