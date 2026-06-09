## Goal

When the floating-number display (the hash "#" assistant) is activated on the Smartboard — teacher side or student classwork — it must appear **inside the visible screen by default**, near the bottom of the on-screen writable space. Today it defaults to the bottom of the writable *band* (12 lines tall), which lands far below the fold, so the user has to zoom out to reach it. After the user zooms or drags it, their chosen position is still respected.

## Why it happens

In `PresentationView.tsx` the assistant panels live **inside the scrolling board surface** and are positioned in board pixels. The default vertical position is:

```text
defaultY = bandBotPx - LINE_HEIGHT * 0.6
bandBotPx = MARGIN_TOP(72) + (bandEnd + 1) * LINE_HEIGHT(64)
```

For a problem beat the band is 12 lines, so `bandBotPx ≈ 1032px` and `defaultY ≈ 994px`. On a typical screen (~500-700px visible) that is well below the viewport, so the panel renders off-screen until you zoom out.

`FloatingNumberPanel` only initializes/re-anchors its `y` from `defaultYPx` on mount and on `beatId` change — not when the panel is toggled visible — so even a corrected default wouldn't apply on first hash-click without a small re-anchor change.

## Changes

### 1. Compute a viewport-aware default position (`PresentationView.tsx`)

- Add lightweight tracking of the scroll host's visible height via a `ResizeObserver` on `boardScrollRef` (store `clientHeight` in state) so the default recomputes when the screen/zoom changes.
- In the assistants render block (around lines 1860-1876), compute an on-screen default using the live scroll host:

```text
visibleBottom = host.scrollTop + host.clientHeight - paddingBottom(panel/tab)
onScreenDefault = visibleBottom - LINE_HEIGHT * 1.1
defaultY = clamp(
   min(bandBotPx - LINE_HEIGHT * 0.6, onScreenDefault),
   finalLineBottomPx + 8,     // never above the last written line
   bandBotPx - LINE_HEIGHT*0.6 // never below band bottom
)
```

This places the panel "towards the end" of the currently visible space (matching the user's description of the gap below a published solution), never below the fold, and still inside the writable band.

- Pass this corrected `defaultY` to the `FloatingNumberPanel` (the hash assistant).

### 2. Re-anchor on activation (`FloatingNumberPanel.tsx`)

- When `visible` transitions to `true` and there is **no** remembered position (`rememberedY == null`), set `y` to `defaultYPx`. This guarantees the very first hash-click drops the panel into the visible area. Once dragged (which calls `onCommitY`, storing `rememberedY`), the remembered value wins and this default no longer overrides it.

## Scope / behavior notes

- Applies to both teacher Smartboard and student classwork (assessment mode reuses the same `PresentationView` + `FloatingNumberPanel`).
- Manual drag and per-beat memory keep working unchanged; zoom still lets the user reposition freely.
- This is a frontend/presentation-only change — no backend, grading, or data-model changes.
- Optional (not included unless you want it): apply the same viewport-aware default to the Structures and Symbols assistants, which share the same off-screen default today.

## Verification

- Open an empty Smartboard on a normal-height window, click the hash icon → the floating number strip appears within the visible area near the bottom of the writable space (no zoom needed).
- Repeat on the student classwork board.
- Drag it elsewhere, switch beats/lines, confirm the dragged position is remembered; confirm zooming still lets it be moved.
