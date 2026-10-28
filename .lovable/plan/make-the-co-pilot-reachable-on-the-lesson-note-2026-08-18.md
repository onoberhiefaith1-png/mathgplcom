# Make the Co-Pilot reachable on the lesson note

The Co-Pilot was built and is in the project: a **MyGPL Co-Pilot** button in the lesson note top bar that opens a right-hand chat dock. The reason it is not showing is the top bar itself: on your current window (796 px wide) the bar lays out Shelf, the note title, Save to class, Co-Pilot and Present in a single non-wrapping row whose buttons cannot shrink, so the right-hand buttons run past the edge of the screen. The dock is also gated to screens 768 px and wider, so even when opened it can end up with nowhere to sit.

## What changes

1. **Top bar becomes responsive.** Buttons collapse to icon-only below roughly 1024 px so Co-Pilot and Present always stay on screen, and the title truncates first instead of pushing them out. The bar never overflows horizontally.
2. **Co-Pilot always reachable.** On narrow screens the Co-Pilot opens as a slide-over drawer covering the right portion of the screen instead of being hidden; on wide screens it keeps the current side-by-side dock at one third width.
3. **Nothing else moves.** Same button, same position (between Save to class and Present), same panel and behaviour — only the layout at smaller widths is fixed.

## Technical notes

- `src/pages/NotebookEditorPage.tsx`: header row gets `min-w-0` / `flex-wrap`-safe layout, `shrink-0` on the action buttons, and responsive labels (`hidden lg:inline` on the text, icon always visible). Replace `hidden md:block` on the Co-Pilot container with: side panel at `md` and above, and a fixed overlay drawer (with backdrop, closed by the panel's existing `onClose`) below `md`.
- No changes to `CoPilotPanel.tsx`, `conversation.ts`, `actions.ts`, the editor bridge, or the `copilot` mode in `notebook-ai`.

## Verification

Open the note at the current window size: the sparkle **MyGPL Co-Pilot** button is visible in the top bar, clicking it opens the chat dock, and closing it restores the full-width note.
