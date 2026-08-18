# Independent scrolling for the Slide Canvas panel

## What's happening now

The Slide Canvas panel is already a side-by-side sibling of the lesson note column, and it already has an inner scroll area. The reason it still drags along with the note is one level up: the notebook editor page is a `min-h-screen` column, not a fixed-viewport column. Because the page is allowed to grow taller than the window, the editor (and with it both columns) grows to the height of its content, the note column's own scrollbar never engages, and the browser scrolls the whole page instead — carrying the Slide Canvas, including "+ Create Canvas", up out of reach.

So this is a height/containment fix, not a redesign. Nothing about the panel's features, width, buttons or canvas behaviour changes.

## The fix

1. Lock the notebook editor page to the viewport height so the two columns can never push the page taller than the window. The sticky page header stays as it is; the editor area below it becomes the only thing that fills the remaining space, with its own overflow contained.

2. Make the lesson note column the only scroller for the note. It already has `overflow-auto`; once the page stops growing, this scrollbar becomes the note's real scrollbar, and no second scrollbar appears for the note.

3. Make the Slide Canvas panel a self-contained full-height scroller:
   - The panel root fills the row height and clips its own overflow.
   - The header ("Exit Slide" / "My Canvases") stays pinned at the top of the panel.
   - The "My Canvases" list (with "+ Create Canvas") and the open-canvas body each get a properly constrained scroll area with its own vertical scrollbar on the panel's right edge.
   - Add scroll containment so reaching the end of the panel's scroll does not chain into the note (and vice-versa).

4. Verify with a browser pass: scroll the note to the bottom and confirm the Slide Canvas header and "+ Create Canvas" stay in place and reachable, then scroll inside the panel and confirm the note does not move.

## Technical notes

- `src/pages/NotebookEditorPage.tsx` — the wrapper is `min-h-screen flex flex-col` with `<div className="flex-1 min-h-0">` around `DocumentEditor`. Switch the page shell to a fixed viewport height (`h-[100dvh]`, `overflow-hidden`) so `DocumentEditor`'s `h-full` resolves against a real height instead of auto.
- `src/components/lessonnotes/DocumentEditor.tsx` — the row `flex-1 min-h-0 flex` (~line 2743) already hosts the note column (`min-w-0 flex-1 overflow-auto`) and `<SlidePanel />` as siblings; add `overflow-hidden` on the row and `overscroll-contain` on the note scroller. No change to the properties-panel padding trick.
- `src/components/lessonnotes/slides/SlidePanel.tsx` — root becomes `h-full min-h-0 overflow-hidden`; the canvases list at line 317 gets `min-h-0 … overflow-y-auto overscroll-contain`; the canvas-open branch (lines 389/443/490) and the slide rail at line 445 get the same `min-h-0` + contained scrolling so the flex chain actually caps its height.
- Same containment applied where `DocumentEditor` is embedded in `src/components/smartboard/CompanionNoteBoard.tsx` only if that host also lets the editor grow past its box.
