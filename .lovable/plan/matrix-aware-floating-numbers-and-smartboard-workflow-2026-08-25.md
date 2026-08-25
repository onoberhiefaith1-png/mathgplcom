# Matrix-aware Floating Numbers and Smartboard workflow

## Goal
Make a matrix stay a real matrix throughout the Floating workflow instead of becoming loose text fragments. A highlighted 2 by 2 matrix should appear as a single matrix step, then open on the Smartboard as an editable 2 by 2 grid where each cell is assessed independently.

## What will change

1. **Recognize matrices as grid-backed structures**
   - Parse LaTeX matrix environments such as `\begin{bmatrix} ... \end{bmatrix}` into rows, columns, bracket type, and cell contents.
   - Preserve the original visible matrix form for display, while adding cell metadata for Floating and Smartboard interaction.

2. **Floating Highlighting page**
   - Keep matrices atomic visually so they render like the Lesson Note, not raw `bmatrix` text.
   - When the teacher selects a whole matrix, save enough metadata for the next stage to know it is a matrix workspace.

3. **Floating Generating page**
   - Show the matrix as the first-class highlighted item, similar to how tables are shown.
   - Generate per-cell/per-row child lines from the matrix without renumbering the main solution line sequence.
   - Keep the main step as one matrix item, with children like `M1.1`, `M1.2`, etc.

4. **Smartboard Board A**
   - Render the matrix as an actual matrix object at the point where it appears in the solution flow.
   - Clicking/opening the matrix should show the same dimensions and bracket style, not a table-looking fallback.
   - Students/teachers type directly into matrix cells using the existing math cell editor, so shortcuts such as `/`, `#`, and `##` work inside cells.

5. **Evaluation and marking**
   - Validate matrix cells independently, using the same immediate line/track marking behaviour already implemented for Smart Tables.
   - Completing a matrix child track should assess it immediately before moving to the next child track.
   - Store the expected matrix cell values in the answer key, not just the final rendered matrix string.

## Technical details

- Extend the existing table-grid model rather than creating a new drawing system.
- Add a matrix parser to the floating grid utilities, reusing the existing LaTeX/tree parser where useful.
- Carry matrix metadata through `FloatingLine.table` or a compatible shared grid shape so the existing branch/group logic can be reused safely.
- Add a matrix-specific Smartboard stage only where table rendering would visually misrepresent the matrix.
- Keep all generated matrix rows tied to the active question/solution; no fallback matching by index to unrelated solutions.

## Validation

- Add unit tests for parsing `bmatrix`, `pmatrix`, and nested expressions inside matrix cells.
- Verify the Floating Generating page displays the matrix as a matrix item, not raw text.
- Verify the Smartboard opens a 2 by 2 matrix and accepts entries cell-by-cell.
- Verify table behaviour still works unchanged.
