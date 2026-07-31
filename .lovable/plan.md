# Readable dictation, truly editable table cells, insert rows/columns in place

Three fixes: the AI box shows dictation as paragraphs, table cells become fully hand-editable and always solvable, and a soft-selected cell drives full-row / full-column insertion.

## 1. AI box — dictation reads as paragraphs

Today the prompt box is a single-line `<input>` in `AiPopover.tsx`, so a long dictation scrolls sideways and only a few words are visible.

- Replace it with an auto-growing multi-line box (starts ~3 lines, grows to about 10 before scrolling), so the whole instruction is readable at a glance.
- Enter still sends; Shift+Enter adds a line break.
- The transcript is formatted before it lands: sentence ends become line breaks and a new recording starts a fresh paragraph (blank line) after existing text, instead of being glued on with a space.
- Same treatment in the AI Edit panel and the floating Assistant panel so every mic box behaves alike.

## 2. Table cells — my edit always wins, and the table stays smart

Two confirmed causes of "I delete it and it comes back":

- The cell editor commits only on Enter. There is no commit on blur, so clicking anywhere else throws the edit away and the old text re-renders.
- The evaluator rejects anything containing `=` inside the text. An AI-generated cell such as `14 − 15.78 = −1.78`, after the right-hand side is deleted, can still carry a trailing `=`, so pressing Enter neither solves nor keeps a clean value.

Fixes:

- Commit on blur, exactly like Enter. Clicking away, tabbing away or clicking another cell saves what was typed.
- Empty is a legal value: clearing a cell and leaving it stores empty and it stays empty.
- Evaluation becomes forgiving: leading/trailing `=` is ignored, and for `left = right` the left side is evaluated, so `14 − 15.78` (or `14 − 15.78 =`) yields `−1.78` on Enter whether the cell was typed by hand or written by AI. Unicode minus, ×, ÷, √ and superscripts already normalise.
- An AI-written cell is treated identically to a typed one — there is no separate read-only state anywhere in the table.
- Tab / Shift+Tab commit and move to the next / previous cell so a whole row can be corrected quickly.
- The cell instruction sent to AI Edit now says plainly that it may delete, replace or restructure the cell contents (not only append), and it carries the row/column headers as context so "make it −1.78" and "just the result" are followed.

## 3. Insert full rows and columns from a soft-selected cell

Row/column handles exist but require aiming at a thin strip. New behaviour, matching what was described:

- Clicking directly on a cell's text starts editing that value (unchanged).
- Clicking the empty padding around the text inside a cell soft-selects that cell: a light blue wash, text still fully readable, no editor open.
- With a cell soft-selected, the Properties Panel shows: Insert row above / Insert row below / Insert column left / Insert column right / Delete row / Delete column / Move row up / down / Move column left / right.
- Insert always inserts a complete row or a complete column at that index, shifting the rest down or right — never a partial cell shift. Inserting a row below the `14 − 15.78` row pushes it down and leaves a blank row in the gap.
- Esc, or clicking outside the table, clears the soft selection. The existing steppers, Σ summation and cell AI Edit are untouched.

## Technical notes

- `AiPopover.tsx`: `input` → auto-sizing `textarea` with `rows`/`max-height`; Enter fires, Shift+Enter newlines. `useVoiceInput.ts` gains transcript paragraph formatting and a paragraph-break append (`prev + "\n\n" + text`).
- `evaluator.ts`: `stripAssignment()` helper used by `tryEvaluate` and `cellNumber` — trims a trailing `=`, and for `a = b` evaluates `a`.
- `SmartTable.tsx`: `InlineEditor` gains `onBlur={onCommit}` and Tab handling; `finishEdit` stores `""` for cleared cells; new `softCell` state (`{r,c} | null`) set from a click on the cell's padding zone (an inner text hit-target distinguishes text clicks from padding clicks), rendered with the light-blue wash and surfaced through `useRegisterAssetEditor` alongside the existing line controls; insert/delete/move reuse the existing `addRow/addCol/delRow/delCol/moveRow/moveCol` operating on `cells`, `headers` and `colWidths` together.
