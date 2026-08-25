# Matrix Floating + Smartboard Correction Plan

## Goal
Make matrices behave like existing mathematical structures such as square roots and fractions: one compact structure token in Floating Numbers, then a full editable matrix structure when tapped on the Smartboard.

## What I confirmed
- Matrix LaTeX is currently promoted into a `TableGrid` in the Floating Generating page.
- That makes matrices enter the table workflow: workspace controls, row/column generation, `M1.1` branch children, and `TableActivityStage` rendering.
- The existing Smartboard math tree already has real matrix structures through `mkMatrix(...)`, and the Matrix Builder already creates matrix nodes with dimensions and brackets.

## Required behaviour
1. **Floating Generating page**
   - Stop treating a highlighted matrix as a table workspace.
   - Show it as one mathematical structure, the same category as `√`, fraction, exponent, and bracket.
   - The visible chip should be compact and teacher/student-readable, for example:
     - `[ 2 × 2 ]`
     - `( 2 × 3 )`
     - `[ 3 × 3 ]`
   - Do not show matrix rows, columns, table controls, or `M1.1`, `M1.2` child lines for normal matrices.

2. **Preserve the matrix payload**
   - Parse the original matrix once to capture:
     - rows and columns
     - bracket type
     - each cell expression, e.g. `2+1`, `1+2`, `3+5`, `4+3`
   - Keep that data attached to the single matrix token so the visual chip is simple but the full matrix is not lost.

3. **Smartboard click/tap behaviour**
   - When the compact matrix token is clicked, insert a real Smartboard matrix node at the current sensor position.
   - The inserted matrix must use the existing `mkMatrix` structure, not a table.
   - It should open/display as the full matrix with its correct cells and bracket style, just like square root opens as a square-root structure and fraction opens as a fraction structure.

4. **Table workflow remains separate**
   - Keep actual tables in the existing table workflow.
   - Do not remove Smart Table behaviour, row/column assessment, or table rendering.
   - Only mathematical matrices leave the table branch system.

5. **Regression checks**
   - Add focused tests for:
     - matrix tokenization stays one token
     - `bmatrix` / `pmatrix` dimensions are parsed correctly
     - the Floating Generating page no longer creates table entries for matrices
     - a matrix token maps to a Smartboard matrix node with the right dimensions, brackets, and cell expressions
   - Run the focused tests after implementation.

## Technical approach
- Introduce a lightweight matrix-token metadata helper that can parse LaTeX matrix environments into `{ rows, cols, bracket, cells, sourceLatex }`.
- Update `FloatingNumbersPage.tsx` so matrix highlights remain text/structure lines instead of `kind: "table"` entries.
- Extend the floating chip insertion path in `FloatingNumberPanel.tsx` and `PresentationView.tsx` to detect matrix tokens and insert a populated `mkMatrix(...)` node.
- Keep `gridFromMatrixLatex` available only where a table-like matrix workflow is explicitly needed later, but stop using it for normal Floating Number generation.
