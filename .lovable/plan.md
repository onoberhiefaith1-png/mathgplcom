# Simplify the Lesson Notes toolbar + Note Extend/Shrink + Paper controls on Floating Highlighting

## 1. Toolbar cleanup (Lesson Notes editor)

Remove from the ribbon in `src/components/lessonnotes/DocumentEditor.tsx`:

- Bold, Italic, Underline
- Heading 1, Heading 2
- Bulleted list, Numbered list
- Objects (the math-objects picker button)

Everything else stays exactly as-is: Undo/Redo, Asset Library, Section, Table, Diagram, 3D, Graph, Calc, Conversion, Advanced (Σ / Animate / AI / Symbols), Emojis, Paper Size, Paper Type, Zoom, Export, Scan, Present.

Notes: the underlying formatting still works via keyboard shortcuts and AI output — only the buttons go. The Objects picker component stays in the codebase but is no longer reachable from the ribbon.

## 2. Note Extend / Note Shrink

Two new ribbon buttons placed where the removed formatting buttons were:

- **Note Extend** — each click adds a fixed slab of writing space (about 5 cm) to the bottom of the page. No upper limit; keep clicking to keep growing.
- **Note Shrink** — each click removes one slab, but never below the bottom of the last piece of content (paragraph, diagram, image, table, graph, math object). When the page is already tight against the last object, Shrink is disabled with a tooltip explaining why. Content is never cropped or hidden.

How it works:

- The page sheet gets an extra-height value in millimetres, added to the paper's natural height as `minHeight`, so the sheet grows downwards and the extra area uses the same paper background (ruled / grid / dotted).
- Before shrinking, the editor measures the bottom edge of the last rendered content inside the sheet and clamps the new height so it can never fall under it.
- The value is saved per notebook so the page height survives reload, and it resets sensibly if the paper size changes.

## 3. Paper controls added to the Floating Highlighting page

Additive only — the Lesson Notes editor keeps its Paper Size, Paper Type and Export controls unchanged.

Add to the header of `src/pages/FloatingPreparationPage.tsx`:

1. **Paper Size** dropdown — A4, Letter, Legal.
2. **Paper Type** dropdown — Plain White, Ruled Notebook, Mathematics Notebook, Grid Paper, Dotted Paper. Changing it immediately repaints the solution document background (the page currently hardcodes a ruled background; it will use the shared paper background instead).
3. **Export** dropdown — DOCX and PDF (via Print), same two options as the editor.

Both dropdowns read and write the same notebook fields the editor uses, so a change on either page is reflected on the other.

## Technical section

- `DocumentEditor.tsx`: delete the Bold/Italic/Underline/H1/H2/list `<Btn>`s and the Objects button (and now-unused icon imports); add `Note Extend` / `Note Shrink` buttons wired to new `pageExtraMm` state passed down from `NotebookEditorPage`.
- `PageFrame.tsx`: accept an `extraMm` prop, add it to `minHeight` on both sheet and inner, and expose a ref to the content area for measurement.
- Shrink clamp: measure `lastElementChild.getBoundingClientRect().bottom` inside the sheet content (adjusted for zoom) against the sheet top + margin; floor the new height at that value.
- Persistence: additive migration adding `notebooks.page_extra_mm integer not null default 0` (GRANTs already exist on the table; no policy change). `NotebookEditorPage.updatePaperSettings` is extended to persist it.
- Paper rendering shared: extract `paperBackground`, `PAPER_SIZES`, `PAPER_LABELS`, `paperOptions` usage so `FloatingPreparationPage` can reuse them without importing the editor.
- Export shared: move `handleExportDocx` out of `DocumentEditor.tsx` into a helper module (e.g. `src/lib/lessonnotes/exportDocx.ts`) so both the editor and the Floating page call the same routine; PDF stays `window.print()`.
- `FloatingPreparationPage`: load `paper_size` / `paper_style` with the notebook, render the two selects + Export dropdown in the sticky header, and apply the paper background/width to the solution document container.
