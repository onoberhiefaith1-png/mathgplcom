# Fix the Approve & Go Live pipeline (equation → floating numbers → note)

## What I verified in your actual lesson note

The subsection you are working on (`Quadratic Equation`, Example 1) stores 15 highlights and 14 floating lines. Reading those rows shows three separate faults:

1. **The note "Compare with ax² + bx + c = 0:" was never saved.** The note-capture step in `FloatingPreparationPage.tsx` runs a "note purity" filter (`looksLikeMathLine` + `stripMathLines`) that deletes any prose line containing `=`, `+`, `-`, `/` or `^`. Your note contains `=` and `+`, so it was thrown away before saving. The highlight for `2x² + 5x − 3 = 0` therefore has an empty note in the database — the preview is telling the truth; the data lost the note. Every teaching note that mentions maths ("Compare with…", "Substitute x = 2…", "Since b² − 4ac > 0…") is being destroyed the same way.

2. **The chips are paired to the wrong equation.** In the saved `floating_lines`, the row whose equation is `2x² + 5x − 3 = 0` carries the chips `a  =2,  b  =5,  c  =−3`, and the row whose equation is `a = 2, b = 5, c = −3` carries the quadratic-formula chips. The whole array is shifted by one line, so on the board line L2 shows another line's floating numbers.

3. **The preview you screenshotted is reading a different subsection with no highlights at all** (`floating_highlights = []`, `floating_lines = []`). In that state `buildReservoirs` falls back to "derive a row per solution line", which is why prose ("Compare with ax² + bx + c = 0:") appears as an *equation row* with "Floating numbers not yet available" underneath. That fallback is producing fake structure and must not run for a note that has a real solution but no prepared highlights.

## The arrangement Approve & Go Live must show

For every line of the solution, in document order, one block:

```text
LINE 1   [ 2x² + 5x − 3 = 0 ]        ← editable equation
         (no floating numbers yet)   ← only when genuinely none
         note: Compare with ax² + bx + c = 0:

LINE 2   [ a = 2, b = 5, c = −3 ]
         chips: a  =2,  b  =5,  c  =−3
         note: Using the quadratic formula:
```

Equation on top, that line's own floating numbers under it, that line's own note under that. Prose that stands alone (e.g. "For", "Therefore:") stays a note-only block with no equation and no chip row. Nothing is invented, nothing is borrowed from a neighbouring line.

## Work to do

### 1. Stop destroying notes that contain mathematics
In `src/pages/FloatingPreparationPage.tsx`, replace the blanket `looksLikeMathLine` rejection with a narrow test: a chunk is dropped only when it has **no words** (pure symbols/digits, e.g. a stray `= 0`). Any line containing alphabetic prose is kept verbatim as the note, mathematics included, and rendered through the maths renderer. The same relaxed rule goes into the read-side guard so the note is not filtered again on the way out (`presentation.ts`, `createAssessment.ts`, `boardWriter/noteSource.ts`).

### 2. Make chip↔equation pairing identity-based, never positional
- In `FloatingNumbersPage.tsx`, delete the positional fallback (`idx = hi`) that lets a highlight claim a persisted row at the same index. Pairing is by `lineId` first, then by exact equation payload; no match means the row starts empty rather than stealing another line's chips.
- Persist the owning highlight's `groupId`/`lineId` on each floating line when it is generated or edited, so the link survives edits and re-generation.
- Add a repair pass that runs once per subsection on load: if a stored row's chips do not decompose the row's own equation but do decompose the next equation, re-key the array by equation and report it in the console. This corrects the already-shifted saved data for this note without deleting teacher work.

### 3. Remove the fake fallback rows
In `src/lib/smartboard/presentation.ts`, the "derive chips from solution equations" fallback stops emitting rows for prose lines and stops manufacturing equation rows when the subsection has a solution but no highlights. In that state the preview shows the solution lines as notes with an explicit "Not prepared — open Floating Numbers" prompt for that question, so the teacher sees a truthful state instead of prose posing as an equation.

### 4. Make Approve & Go Live the editing surface
In `src/pages/SmartboardPreviewPage.tsx` (and the mirrored `PresenterPreviewPanel.tsx`):
- Render each line as equation → chips → note, in that order, with note-only rows rendered as a note block alone.
- The equation becomes editable in place using the existing universal maths editor (`MathCellEditor` / `MathInlineCanvas`), so the teacher can type real mathematics, and the note becomes an editable text area.
- Chips remain editable as text chips (add, remove, reorder) using the same normalisation as the Floating Numbers page.
- Saving writes back to `notebook_subsections.floating_lines` / `floating_highlights` for that subsection — the same columns the Floating Numbers page and the Smartboard read — so this page is the single final audit point and both downstream surfaces immediately reflect it.
- "Floating numbers not yet available" only shows when that line truly has no chips; it never shows on a note-only row.

### 5. Verification
- Unit tests: a note containing `=`/`+` survives capture; chips never pair to a non-matching equation; the fallback emits no prose-as-equation rows.
- Re-open Approve & Go Live for this quadratic note and confirm each line shows its own equation, its own chips, and its own note, then confirm the Smartboard shows the same pairing.

## Out of scope

No change to how solutions are generated or highlighted, no renumbering of questions, no new tables.
