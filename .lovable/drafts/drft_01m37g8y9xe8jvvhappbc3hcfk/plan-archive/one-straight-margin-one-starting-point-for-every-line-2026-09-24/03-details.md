## Technical detail

1. **Margin becomes the only start coordinate**
   - `gameSurfaceBox`/`writingSurfaceFrame` in `src/lib/slate/layout.ts` keep the fixed
     `outerLeft`, and expose one authoritative `contentLeft = outerLeft + padX + tagGutter + appliedMargin`.
   - Remove the `<group position={[surfaceBox.contentMargin / 2, 0, 0]}>` translation in
     `SlateColumn.tsx`; the margin is consumed by `contentLeft`, not by shifting the block.
   - `WritingRegion` renders text from `contentLeft` with `align` operating inside the
     remaining content width only.

2. **Per-line saved X becomes indentation, never position**
   - In `src/lib/slate/textConfig.ts`, reinterpret `ax` as `indent` (a non-negative fraction of the
     content width) and enforce `finalX = contentLeft + indent`, with `indent >= 0` clamped so
     `finalX >= contentLeft` is always true. `ay` (vertical) is untouched.
   - Migration-on-read: existing `ax` values are discarded and normalised to `indent = 0`
     (decision: reset all lines to the margin). `resolveSurfaceTextPlacement` stays a validator,
     not a positioner.
   - `alignAnchor`-derived default X and the fallback "surface centre" origin are removed as
     inputs to the start coordinate.

3. **Straight line, independent of the scroll**
   - The margin guide is drawn as a single upright segment in surface-local space spanning the
     content area's top to bottom, using `contentLeft`, with no fold/bevel term and no curvature
     from `surfaceFoldInset`. The fold insets continue to restrict the usable content band only.
   - The handle keeps drag, pointer capture and arrow-key nudge; the guide shows faintly at rest
     and brightens while dragging.

4. **Line tags as surface design**
   - Add a fixed tag strip at the surface's own start (`outerLeft + padX`), width `tagGutter`,
     rendered as part of the surface design and **not** affected by the margin.
   - Tags are derived from the line's index in `game.slots` for that surface: question = `Line 0`,
     then `Line 1`, `Line 2`… They are generated, reordered and removed with their line; no tag is
     an independently positioned text object.
   - `tagGutter` is included in the content-width and surface-growth maths so tags can never
     overlap the writing.

5. **Deterministic settle (fixes the shaking and the update-depth error)**
   - Measurement runs only when text, appearance key, margin, tag gutter or band width change.
     Compare with the existing tolerance and stop — remove the per-frame corrective guard as a
     routine mechanism, keeping the **Text** icon as a manual fit.
   - The current "Maximum update depth exceeded" loop in the Game surfaces comes from
     measure → resize → measure; with one start coordinate the loop has no second opinion to
     fight, and the settle cap stays as a hard stop.

6. **Unchanged**
   - Fixed left edge, content-driven right edge, fold never written on, all Text Settings
     (size, depth, colours, shadow, effects), teacher vs student margin ownership, Reset,
     rewards, marks and timing.

## Verification

- Unit tests: `finalX >= contentLeft` for every line and alignment; moving the margin changes
  every line's start by the same amount; a saved sideways nudge cannot place a line before the
  margin; tag strip position is invariant to the margin; repeated measurement is idempotent.
- Browser checks on the affected Game with `2(x + 3) − 4x = 8`: all lines share one start,
  tags read Line 0 … Line 5 in order, drag the margin both ways, change text size/depth/colour,
  then save, reopen, preview, play, test, reload and resize — no trembling, no console update-depth
  error, no writing on the fold.
