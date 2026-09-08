# Smartboard top bar — responsive wrapping on phone and tablet

The foldable top bar keeps folding exactly as it does now. Only its inner layout changes, and only on phones and tablets.

## What changes

1. **Full-screen button hidden on phone/tablet**
   The full-screen toggle button that floats at the top-right of every page is hidden below the desktop breakpoint, so the top bar no longer competes with it for space. Desktop keeps it.

2. **The bar becomes a wrapping container on phone/tablet**
   Instead of one fixed-width centered pill sized to its content, on touch widths the bar spans the usable screen width (edge margins and safe areas respected) and its controls wrap onto as many rows as needed. No fixed row count, no horizontal scrolling, no clipping, nothing hidden behind a menu.

3. **Panel height follows content**
   Because the bar sizes to its rows, two or three rows simply make the panel taller. The fold pull-tab keeps sitting directly beneath the bar's real height rather than a hard-coded offset, so it stays reachable at any number of rows.

4. **Groups stay together**
   Related clusters (workspace switch, zoom, page counter with Prev/Next) wrap as whole units so a group never splits mid-way; touch targets grow slightly on phone for comfortable tapping.

5. **Desktop untouched**
   Desktop/laptop keeps today's single-row centered pill and its current sizes. The five previously removed icons stay removed.

## Technical notes

- `src/components/common/FullscreenToggle.tsx`: return `null` below the desktop breakpoint using the existing `useBreakpoint`/`useIsTouchLayout` hook — no changes to `__root.tsx`.
- `src/components/smartboard/PresentationView.tsx`, the `<header data-sb-chrome>` block (~line 5671):
  - touch layout: `left-2 right-2`, `translate` on Y only, `flex-wrap`, `gap-x-2 gap-y-1.5`, `w-auto`, no `max-content` width, `max-w-none`; desktop layout string kept byte-identical in the false branch.
  - wrap the existing counter/Prev/Next/settings row (`flex items-center gap-1`) with `flex-wrap` on touch, and drop `truncate`/`max-w-[420px]` clamping on the title so it wraps instead of being cut.
  - measure the header with a `ResizeObserver` (same pattern already used for `chromeMeasureRef`) and drive the pull-tab's `marginTop` from the measured height when open, replacing the fixed `44`.
- Orientation and resize are handled automatically by flex wrapping plus the observer; no reload needed.
- No changes to the Floating Number panel, board logic, math, navigation, or any control's behaviour.

## Verification

Typecheck, then browser screenshots of the opened bar at narrow phone portrait, phone landscape, tablet portrait/landscape, and desktop, confirming every control visible, nothing clipped or overlapping, and desktop unchanged.
