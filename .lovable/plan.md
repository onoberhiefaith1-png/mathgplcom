## Goal
Two presentation fixes on the Smartboard:

A. **Floating Number panel — full-body drag with bounded movement.**
B. **Bottom (Values/Symbols/Structures) panel — never auto-opens; opens only when its pull-tab is explicitly clicked.**

---

## A. Floating Number panel drag

### Current state
- `src/components/smartboard/FloatingNumberPanel.tsx` already has the boundary math wired:
  - Upper bound = `finalLineBottomPx + 3 * rowHeightPx` (3 free rows below the last completed equation/structure).
  - Lower bound = `bottomYPx` (top of the next section / next major lesson element, fed from `PresentationView`).
- Drag pointer handlers exist (`onPointerDown / onPointerMove / onPointerUp`) but they are wired ONLY to a tiny 14×28 px grip square. The user can rarely catch it and the rest of the panel ignores pointer-drags.
- The outer halo (`<div onPointerDown={(e) => { e.stopPropagation(); onPing(); }}>`) intentionally swallows pointer events to protect the writing surface, but it does not initiate the drag — so dragging the chip strip or the line badge does nothing.

### Change
1. Move the pointer-down/move/up handlers from the small grip onto the outer halo `<div>` itself, so dragging anywhere on the panel body moves it.
2. Keep button click semantics intact:
   - Buttons inside (ChevronUp, ChevronDown, individual chip buttons, ping) call `e.stopPropagation()` on their own pointer-down so the drag never starts when the user is clicking a chip or arrow.
   - Use a `pointerdown → pointermove` distance threshold (~4px) before flipping into drag mode; a tap inside an empty area of the panel still counts as a click/ping, not a drag.
3. Keep the bounds clamp exactly as today (`upper = finalLineBottomPx + 3*rowHeightPx`, `lower = bottomYPx`). Drag commits `y` via `onCommitY(y)` on pointer-up, so per-beat persistence still works.
4. The small visual grip rectangle stays as an affordance (cursor: grab) but no longer needs its own listeners.

### Code touch points
- `src/components/smartboard/FloatingNumberPanel.tsx` lines 455–536. Single file; no API change to `PresentationView`.

---

## B. Bottom panel — strict click-to-open

### Current state
- `src/components/smartboard/BottomPanel.tsx` renders a 22px pull-tab and a 320px `<section>` that translates off-screen when closed. When closed, the `<section>` still receives pointer events (no `pointer-events: none`), and on some swipe paths the off-screen panel can be hit/animated accidentally.
- `panelOpen` only changes through `onToggle`; the user reports the panel "appears on its own" — most likely on touch/track-pad scroll the pull-tab swallows the gesture, or the section catches a click in its 320px below-the-fold region during layout transitions.

### Change
1. When `open` is false:
   - Add `pointerEvents: "none"` to the `<section>` and `visibility: "hidden"` after the slide-out transition ends. The pull-tab keeps `pointerEvents: "auto"` and remains the sole entry point.
   - Add `tabIndex={-1}` and skip focus traps when closed.
2. Pull-tab hardening:
   - Use `onClick` only — remove any incidental pointer-down handlers that could trigger on swipe.
   - Add `e.stopPropagation()` + `e.preventDefault()` in the click handler to make sure the toggle is a deliberate input.
3. No auto-open effect anywhere — confirm there is no `setPanelOpen(true)` outside the toggle button (search-and-verify in `PresentationView.tsx`).
4. Persist `panelOpen` to `localStorage` so a reload does not silently reopen it.

### Code touch points
- `src/components/smartboard/BottomPanel.tsx` (the `<section>` and pull-tab block).
- `src/components/smartboard/PresentationView.tsx` — confirm `setPanelOpen` is only called by the toggle; persist with `localStorage`.

---

## Out of scope
- Recomputing the upper/lower bounds themselves (already structure-aware from previous turn).
- Adding horizontal drag, snap-to-line, or magnet behavior.
- Reorganizing the Values/Symbols/Structures content.

## Verification
1. Open the quadratic-formula lesson. Place pointer on any empty area of the floating-number strip (not on a chip). Press and drag vertically: the panel follows the pointer, clamped between `finalLineBottomPx + 3*rowHeight` and the next section's top.
2. Click any chip / line arrow inside the panel — no drag is initiated; click action still fires.
3. Reload the page with the bottom panel closed. Scroll/swipe near the bottom edge: the Values/Symbols panel must NOT slide up. Clicking the small pull-tab is the only way to open it; clicking it again closes it.
4. `bun run build` exits 0.