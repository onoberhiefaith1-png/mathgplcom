# Make diagrams reliably appear on the Smartboard

Diagrams are already stored as permanent Notes-layer lesson content, but they are not reaching the board in every case. Below is what the code shows today, what still needs confirming, and the fixes.

## Confirmed from the code

- Capture (`lessonOutline.ts`) records every diagram with `presentOnBoard: true`, a stable `diagramId` and `floatable: false`.
- Save (`syncDocumentToNotebook.ts`) writes objects onto only three places: a subsection's `problem` block, its `solution` block, and the **first** loose block of an Explanation/Introduction/Summary section.
- The sequencer (`presentation.ts`) builds a question beat from `problem` objects plus notes-layer objects of `solution`. Objects living on any other block of a subsection (e.g. `reasoning`, later loose blocks) never become part of a beat, so they cannot be drawn.
- The renderer (`PresentationView.tsx` → `SolutionObjectView`) wraps each object in `pointer-events-none` at `font-size: 0.5em`. A 3D scene renders as a "click to explore" placeholder that can never be clicked, and geometry is scaled to half size — which reads as "no diagram" on a projected board.
- A stale comment in `PresentationView.tsx` still claims geometry inside a Solution is filtered out upstream.

## Not yet confirmed

Which of the two paths caused the diagram you saw missing (never captured into a block, or captured but invisible when rendered). Step 1 verifies this on your actual note before changing behaviour, so the fix targets the real cause.

## Plan

1. **Verify on the real note.** Inspect the saved blocks for a lesson note that has a 2D diagram outside a Solution and one inside, and confirm whether each object row exists and which block holds it.
2. **Never lose an object on save.** Attach objects to the block they actually belong to, and carry objects from every block of a subsection (and every loose block of a section), not just the first / not just problem+solution.
3. **Beat assembly covers all blocks.** Build a beat's object list from all of the subsection's blocks in document order, preserving the layer rule: diagrams render as notes content, tables stay floating-capable.
4. **Make diagrams legible on the board.** Render board objects at full board scale instead of `0.5em`, with the diagram sized to the available board width.
5. **3D scenes must self-render.** Auto-activate a 3D diagram on the presentation board (no click needed) so it never shows as a dark placeholder, and keep the rest of the board non-interactive.
6. **Same result on the student board.** Verify the student mirror shows the identical diagrams, including diagrams that sit inside a Solution (notes layer), and that geometry inside a Solution never enters the floating stream.
7. Remove the stale "filtered out upstream" comments so the code states the current law.

## Technical notes

- Files: `src/lib/lessonnotes/syncDocumentToNotebook.ts`, `src/lib/smartboard/presentation.ts`, `src/components/smartboard/PresentationView.tsx`, `src/components/lessonnotes/SolutionObjectView.tsx`.
- No schema change: objects continue to live in `notebook_blocks.content_json.objects`.
- `SolutionObjectView` gains an optional presentation mode (full scale, auto-active 3D) rather than a second renderer — one diagram engine, one renderer.
- Verification: open a note containing 2D geometry, 3D geometry and a graph, then check the teacher board and the student board render all three.
