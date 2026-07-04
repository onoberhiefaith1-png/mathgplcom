## Goal

Replace the current floating-drawer Presenter Preview with a true **split-screen layout**: when the preview is open, the Preview occupies the left 30% and the entire Smartboard (board + every toolbar, floating control, and chrome button) resizes to the right 70%. Nothing overlays anything.

## Root problem

`PresentationView` renders its chrome as many independent `position: fixed` elements (AssistantButtons, home button, chip toolbars, BottomPanel, toasts, presenter aside, etc.). `fixed` anchors to the browser viewport, so shrinking the board container does nothing — the buttons stay where they were and the preview overlays them.

The fix is structural: introduce a positioned Smartboard **container** and reparent every Smartboard chrome element into it, converting `position: fixed` → `position: absolute`. Then wrap `[Preview | Smartboard]` in a flex row.

## Deliverables

### 1. Split-screen shell in `PresentationView.tsx`

Wrap the current top-level render in:

```text
<div class="fixed inset-0 flex">
  <aside style="width: 30%">   ← PresenterPreviewPanel (only when open)
  <div id="sb-root" class="relative flex-1"   ← Smartboard container
       style="width: presenterPanelOpen ? 70% : 100%">
     ... existing board + all chrome ...
  </div>
</div>
```

- The `<aside>` renders inline in the flex row (not `position: fixed`). Width `30%`, min `320px`, max `520px`.
- The Smartboard container is `position: relative` so every child using `position: absolute` is scoped to it.
- Transition width/transform with `transition: width 280ms ease, transform 280ms ease` on both panes for the smooth slide.

Remove the current fixed-overlay `<aside>` (the one with `className="fixed top-0 bottom-0 left-0 z-30 …"` around line 2854) and the `translateX(-102%)` slide-in behavior. The panel is now part of the layout, not a drawer.

### 2. Reparent chrome so it lives inside the Smartboard container

Every Smartboard-owned control currently uses `position: fixed` and viewport-relative coords (`left: 12`, `right: 12`, `bottom: …`, `top: 50%`, etc.). Convert each to `position: absolute` inside `#sb-root`. Concretely:

- **AssistantButtons** (`src/components/smartboard/AssistantButtons.tsx`) — bottom-left Numbers pill, bottom-right Structures pill, right-edge Symbols pill. Change all three `className="fixed …"` to `absolute`. Their coordinates are already correct once the parent is the 70% container.
- **PresentationView.tsx** fixed elements to convert to `absolute`:
  - Presenter open/close button (~L2832) — currently `absolute` inside the wrong wrapper; anchor to `#sb-root`.
  - Home / navigation floating button (~L3852, ~L3922) — `position: fixed` → `absolute`.
  - Cursor / eraser / floating-number chip toolbars (~L3284, L3375, L3935, L3950, L4170) — `position: fixed` / `className="fixed …"` → `absolute`.
  - BottomPanel container (rendered around L4194) — its outer wrapper switches from viewport-fixed to `absolute` at the bottom of `#sb-root`.
  - Any `fixed left-1/2 top-3` toast/badge that is Smartboard-owned (L4242, L4343) → `absolute` inside `#sb-root`. (System-level toaster stays viewport-fixed.)
- **BottomPanel.tsx** and its subcomponents: check for any inner `position: fixed`; convert to `absolute` so it docks to the resized container.
- Anything using `100vw`/`100dvw` for a Smartboard child gets replaced with `100%` so widths follow the container.

The presenter-preview button's auto-hide + left-edge reveal behavior is preserved; only the anchor changes.

### 3. Preview panel props unchanged

`PresenterPreviewPanel` already renders as a normal block. No prop or highlight-logic changes. It stops receiving the drawer-style `translateX` frame — the flex parent handles visibility by mounting/unmounting or by conditional width.

Header/close-button inside the preview stays; the notebook title and "Following teacher" / "Paused — manual scroll" indicator stay.

### 4. Board coordinate math

The writing surface uses `useMeasureRef` / `getBoundingClientRect()` on the board root, so shrinking the container to 70% is safe: sensor, grid, and floating math already read the live rect. No coordinate constants need changing. Verify by:

- Opening the panel and checking that pen strokes still register under the pointer.
- Confirming floating-number chip positions align with their equation lines after resize.

If any legacy code caches `window.innerWidth`, replace with the container rect from the existing measure ref.

### 5. Persistence + teacher-only + animation

- `smartboard:presenterPanelOpen:<id>` localStorage flag stays.
- Panel + toggle button remain gated on `isTeacher`.
- Both panes animate width in ~280ms; no `translateX` slide.

### 6. Student view

Student board (`StudentSmartBoardPage`) is not affected — no panel, no split. The change is scoped to teacher-side `PresentationView`.

## Files touched

- **edit** `src/components/smartboard/PresentationView.tsx` — introduce split shell, reparent all fixed chrome into `#sb-root`, remove drawer overlay.
- **edit** `src/components/smartboard/AssistantButtons.tsx` — `fixed` → `absolute` on all three buttons.
- **edit (small)** `src/components/smartboard/BottomPanel.tsx` — outer positioning `fixed` → `absolute` if present.
- **edit (small)** `src/components/smartboard/PresenterPreviewPanel.tsx` — drop any assumption it lives inside a fixed drawer (paddings/borders unchanged).

No changes to student view, sync protocol, board data, or preview render logic.

## Acceptance checks

1. Panel closed: Smartboard is 100% width; all controls sit exactly where they do today.
2. Panel opens: preview appears in left 30%, board smoothly shrinks and shifts right to 70%; nothing overlaps.
3. Left-side controls (eraser, `#`, cursor toolbar) now sit against the **new** left edge of the shrunk board — not behind the preview.
4. Right-side controls (Symbols pill, Structures pill, scrollbars) sit against the new right edge, which is the browser right edge.
5. Bottom panel spans only the 70% width and stays attached to the board.
6. Drawing, floating chips, and sensor hits all land correctly after resize.
7. Closing the panel animates back to 100% in ~280ms with no jump.
8. Students see no panel and no layout change.
