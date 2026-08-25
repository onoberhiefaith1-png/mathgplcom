# Implementation details

## Constants
Reuse the same limits the main Smartboard uses so the interaction feels identical:
- `ZOOM_MIN = 0.4` (40%)
- `ZOOM_MAX = 3.5` (350%)
- `ZOOM_STEP = 0.12` (12% per click)
- `clampZoom(z) = max(MIN, min(MAX, z))`

## State
Inside `BoardRelationshipView.tsx`:
- Read an initial zoom from `localStorage` key `smartboard:relationship-zoom:${notebookId}` (fallback 1).
- Store zoom in local state.
- Persist back to `localStorage` whenever it changes.

The component already receives the active scene through `reviewProperties`; it does not currently have the notebook id. The plan is to thread the current `notebookId` into the relationship state (or derive it from `review.active.scene.meta.notebookId` if stored) so the storage key is stable.

## UI
Add a button group in the top bar, to the right of the title:
```text
[−] [100%] [+]
```
- `−` calls `setZoom(clampZoom(zoom - ZOOM_STEP))`.
- `%` calls `setZoom(1)`.
- `+` calls `setZoom(clampZoom(zoom + ZOOM_STEP))`.

Style it like the existing main-board zoom group: compact rounded container, tabular numbers for the percentage.

## Diagram scaling
Wrap the existing `<GeometryDiagram … />` in a `<div style={{ zoom }}>`. This is the same technique already proven in `ReviewableBoardDiagram` for board-level diagram zoom. The parent container stays centred and scrollable, so enlarging the diagram simply overflows and can be panned.

## Scope protection
- Only the left diagram area scales.
- The right `ReviewPropertiesPanel` is a sibling, not inside the zoomed container, so its text and hit targets remain native size.
- The top bar and Close button are also outside the zoomed container.

## Verification
After implementation:
1. Open a floating-number test that has geometry properties.
2. Click the properties icon to open the relationship page.
3. Click + several times — the diagram grows, labels remain crisp, panel stays fixed.
4. Click % — diagram snaps back to 100%.
5. Click − — diagram shrinks.
6. Close and reopen the relationship page — zoom level is remembered.
