# Matrix as a real structure, not a pre-filled object

Selecting a matrix dimension must insert an **empty** bracketed grid with one editable cell per position, exactly like `\frac{□}{□}` and `\sqrt{□}`. Values are typed or tapped into the cells afterwards, never baked into the structure.

## What is wrong today

- On the Floating Numbers prep page, a highlighted matrix is kept as **one atomic chip holding the whole LaTeX payload** (values included).
- Tapping that chip on the Smartboard expands the saved payload **pre-filled** (`2 1 / 3 4` already inside), so the teacher sees a finished matrix beside a `2 × 2` label instead of an empty structure plus loose values.
- The lesson-note palette path (Matrix quick panel / Structures asset) already inserts an empty grid — that behaviour is the model to follow everywhere. It will be re-verified, not rewritten.

## What will change

1. **Matrix = structure + cells (Floating prep)**
   A highlighted matrix produces two things instead of one chip:
   - a **structure shell** chip that carries only `rows × cols` and the bracket pair, rendered as an empty grid preview (`[□ □ / □ □]`, labelled `2 × 2`);
   - one **value chip per cell**, in reading order (`2`, `1`, `3`, `4`), living in the ordinary Floating Numbers row.
   The equation payload itself is untouched, so highlight identity and persistence keep matching.

2. **Tapping the shell inserts an empty matrix**
   The Smartboard insert path takes dimensions + brackets and inserts `mkMatrix(rows, cols, left, right)` with every cell empty, dropping the cursor in the first cell. No value is ever inserted with the structure.

3. **Cells fill independently**
   With the cursor in a cell, typing or tapping a Floating value writes into that cell only; arrow keys / Tab move between cells (existing matrix-cell cursor behaviour, verified with a test). Filling `2`, `1`, `3`, `4` in order reproduces the teacher's matrix.

4. **One object, many cells**
   Brackets remain part of the single matrix node — never separate left/right objects — for 2×2, 2×3, 3×2, 3×3, 4×4 and every other supported dimension. Dimension-only selection, dimensions taken from the source matrix when one was highlighted.

5. **Existing saved lines migrate**
   Lines already saved as a whole-matrix chip are split into shell + value chips on load, so old notes show the new behaviour without losing any cell content.

6. **Explicit templates stay**
   Identity / zero / diagonal / scalar remain available because the teacher chose them deliberately; plain dimension selections never apply a template.

## Technical notes

- `src/pages/FloatingNumbersPage.tsx` — replace `ensureAtomicMatrixFiller` with a shell + per-cell-value split built from `gridFromMatrixLatex`; store `rows`, `cols`, brackets on the line's matrix structure entry; apply the same split in the AI-reconcile branch and in the load migration.
- `src/components/smartboard/FloatingNumberPanel.tsx` — `matrixChipLabel` renders an empty-cell preview; the tap handler emits `{ rows, cols, left, right }` rather than raw LaTeX.
- `src/components/smartboard/PresentationView.tsx` — `insertMatrixAtSensor` takes the dimension descriptor, inserts an empty `mkMatrix`, and places the cursor in cell 1; drop the `latexToTree` pre-fill path. `makeStructureNode("matrix")` keeps returning an empty grid.
- `src/lib/lessonnotes/matrixQuick.ts` / `DocumentEditor.insertQuickMatrix` — verified empty-by-default; only `spec.template` (explicit special type) fills cells.
- Tests: empty insertion for 2×2/2×3/3×3/4×4, structure-plus-values split from a highlighted matrix, sequential cell entry producing `2 1 / 3 4`, legacy chip migration, and a guard that no insertion path ever writes `2 1 3 4` into a fresh structure.

## Verification you can run

Open the floating prep page for a matrix question: the symbols row shows an empty `2 × 2` grid shell and the numbers row shows `2`, `1`, `3`, `4`. Tap the shell on the Smartboard — an empty bracketed 2×2 appears with the cursor in the first cell. Tap or type the values one by one; each lands in its own cell.
