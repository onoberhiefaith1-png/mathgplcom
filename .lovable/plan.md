# Plan: Treat Matrices as Real Floating Structures

## Goal
When a lesson-note line contains a matrix such as `\begin{bmatrix}2+1 & 1+2 \\ 3+5 & 4+3\end{bmatrix}`, Floating must understand it as a 2 by 2 matrix, not as brackets and not as a text/table fragment.

The student Smartboard should let the learner open that matrix and fill each matrix cell in place:

```text
[ 2+1   1+2 ]
[ 3+5   4+3 ]
```

## What I found
- The floating parser now keeps a full LaTeX matrix as one `structure` atom and renders it visually.
- That currently makes the matrix look better, but it still behaves like one flat floating chip rather than a cell-aware matrix workspace.
- The Smartboard already has a cell-aware workflow for Smart Tables, but the structure renderer only covers arithmetic structures such as long division/place value, not matrices.

## Implementation
1. **Add a matrix structure model**
   - Parse LaTeX matrix environments (`matrix`, `pmatrix`, `bmatrix`, `vmatrix`, `Vmatrix`) into rows, columns, bracket type, and cell contents.
   - Preserve each cell exactly as authored; no replacing values, no adding words like “and”.

2. **Update Floating Highlighting behavior**
   - When the teacher clicks/selects a matrix, save it as a matrix structure with its dimensions and cells.
   - Keep the visual rendering identical to the lesson note.
   - Do not classify it as a normal bracket or ordinary text token.

3. **Update Floating Generating page**
   - Show the matrix as a numbered matrix item/workspace, not as loose chips.
   - Display the matrix with real brackets and a 2 by 2 grid.
   - Generate cell-level floating entries from the matrix cells, so `2+1`, `1+2`, `3+5`, `4+3` stay tied to their own cells.

4. **Update Smartboard interaction**
   - On the Smartboard, clicking the matrix opens the matching matrix board in place.
   - Students type into the matrix cells, not into a generic answer box.
   - Marking/evaluation checks each matrix cell against the original lesson-note cell.

5. **Keep tables separate from matrices**
   - Smart Tables remain tables with headers/orientation.
   - Matrices become matrix structures with bracket style, fixed dimensions, and cell addresses.
   - No table headers are introduced for matrices.

6. **Regression checks**
   - Add tests for parsing a 2 by 2 matrix into four cells.
   - Add tests that Floating keeps the matrix as a matrix structure through Highlighting → Generating → Smartboard.
   - Verify matrices, summations, integrals, fractions, and roots still render without raw LaTeX.

## Technical details
- Extend the floating atom/chip model so `structure` atoms can carry typed metadata for matrix structures.
- Add a pure matrix parser/serializer helper for LaTeX matrix environments.
- Extend `FloatingLine` with a matrix-aware reference similar to the existing table reference, but keep it distinct from `FloatingTableRef`.
- Add a Smartboard matrix stage/component that reuses the existing math cell editor and evaluation pattern, without routing matrices through the table workflow.
