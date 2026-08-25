# Matrix quick-access: real matrices, docked on the right

Two problems, both from the same shortcut taken when the palette was added.

## 1. Raw code appears in the note

The palette currently inserts a text string of matrix code (`\begin{pmatrix} … \end{pmatrix}`) into an inline math box. The lesson note's math engine does not read that string — it prints it, which is exactly the raw text on screen.

The fix: the palette must build the same real matrix object the existing Matrix builder builds — a proper bracketed grid with one editable cell per position, brackets that stretch to the row count, superscripts for transpose/inverse, `det`/`adj` in front, and the caret landing in the first cell. Nothing changes about the matrix object itself; only the palette's insert path is corrected to use it.

Special types keep their meaning: identity fills 1s on the diagonal and 0s elsewhere, zero fills 0s, diagonal/scalar fill the off-diagonal with 0s and leave the diagonal editable, row/column force a single row or column. All produced through the existing matrix templates, so they behave and print exactly like matrices made from the full builder.

## 2. It opens over the note instead of beside it

Today the palette is a floating popover in the middle of the screen, covering the page. It should behave like the Emoji Library: a panel docked on the right edge that **shares** the width — the note shrinks and stays fully visible and editable.
