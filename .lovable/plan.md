## Changes

1. **Highlight only on the Presenter Preview.** Nothing on the Smartboard, nothing on the Floating Number Display strip lights up. Remove the orange ring currently drawn around the Floating Number panel in `FloatingNumberPanel.tsx`.

2. **Recolor the Presenter Preview highlight to green.** In `PresenterPreviewPanel.tsx`, swap `HIGHLIGHT_BORDER` / `HIGHLIGHT_SHADOW` from orange to Tailwind green-600 (`rgba(22,163,74,…)`) — "go ahead" green.

3. **Highlight follows the writing sensor, not just Floating Number Display.** Today the Presenter Preview receives `activeLineIdx` from `floatingLineIdx` / `manualFloatingLineIdx`, so it only moves when the FN panel moves. When the teacher clicks a Present chip on line 2 and starts typing there, the sensor is on line 2 but the preview keeps highlighting line 1. Fix: in `PresentationView.tsx`, derive the "current line" from the sensor's row via the existing `rowOwners` map (already exposed as `displayedGuidedIdx`) and pass that as `activeLineIdx` to `PresenterPreviewPanel`. When the sensor row has no owner yet, fall back to the FN idx so nothing regresses. This makes the green ring follow writing on the current line regardless of whether the teacher got there via a Present chip, D-pad move, or FN advance.

## Files touched
- `src/components/smartboard/FloatingNumberPanel.tsx` — drop the active-strip ring entirely (revert the panel to its plain border).
- `src/components/smartboard/PresenterPreviewPanel.tsx` — recolor `HIGHLIGHT_BORDER` / `HIGHLIGHT_SHADOW` to green.
- `src/components/smartboard/PresentationView.tsx` — feed `displayedGuidedIdx ?? floatingLineIdx` into the `activeLineIdx` prop passed to `PresenterPreviewPanel`.

## Verification
- Playwright: click a Present chip on line 2, confirm Presenter Preview line 2 turns green while typing, before touching the FN panel. Screenshot both Smartboard and FN strip — assert neither shows any highlight ring. Move FN to line 3, confirm only the Presenter Preview highlight follows.
- Typecheck + `sensorSpacing.test.ts`.

No backend changes.