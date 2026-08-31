## Technical detail

**Evidence for the diagnosis**

- `git show e472f39d:src/lib/games/removeBackground.ts` — the original
  `makeTransparent` called `@imgly/background-removal` only. That is the code
  path that produced the good building.
- Current `src/lib/games/removeBackground.ts` runs `flatCutImage` first and only
  falls back to the model when the flat cut fails or removes <2% / >97%.
- `src/lib/games/flatCut.ts` → `applyMaskToPixels` writes `alpha = 0` for
  background and a constant `alpha = 110` for a single boundary ring, with a
  fixed `0.12` despill. There is no alpha gradient anywhere, which is exactly the
  jagged rim / shimmer being reported.

**Changes**

1. `src/lib/games/flatCut.ts`
   - Replace the constant boundary alpha with a distance-graded ramp: build the
     boundary band `radius = feather` pixels wide (already supported by
     `markBoundary`) and store the band depth per pixel, then set
     `alpha = round(255 * depth / (radius + 1))` so the edge fades smoothly.
   - Scale despill with the same depth so only genuinely mixed pixels are
     corrected; fully opaque interior pixels stay byte-identical.
   - Default `feather` for images raised from 1 to 2–3 px at native resolution.

2. `src/lib/games/removeBackground.ts`
   - `makeTransparent` order becomes: run the AI model first (the standard).
   - Build the flat region map from the source frame and use it as a guard —
     any pixel the region map marks as *interior* (not connected to the frame
     edge) is forced back to fully opaque in the model's matte, so interior
     white/glass can never be lost.
   - Any pixel the region map marks as edge-connected background stays removed,
     which also clears leftover backdrop the model missed.
   - Only if the model is unavailable or produces no transparency does the flat
     cut run alone (now with the graded edge).
   - Keep native resolution and lossless PNG output.

3. Existing saved buildings — `src/pages/homepage/HomepageBuildingPage.tsx` /
   `HomepageReplaceBuildingPage.tsx`
   - Add a "Re-cut background" action per building slot that fetches the stored
     original upload, re-runs `makeTransparent`, stores the new cut-out and
     restages the building. No geometry, speed, blend, opacity, layer or route
     change; the homepage updates only on Save Building as today.
   - When only the cut-out was stored (no original kept), the action re-cuts from
     that file and says so, since the model can still soften the edge.

4. Video (`src/lib/games/videoChromaCut.ts`, `ChromaVideo.tsx`)
   - Unchanged approach (the model cannot run per frame), but they consume the
     same graded-edge helper so a keyed video edge fades like the image edge.
   - Final Touch keeps tuning tolerance/feather/loop-fade on top of this.

5. Shared standard
   - `src/lib/games/assets.ts` and
     `src/components/assets/manage/AssetFormDialog.tsx` already call
     `makeTransparent`, so they inherit the standard with no signature change.

**Tests**

`src/lib/games/flatCut.test.ts` gains cases for: graded alpha across the band
(strictly increasing away from the background), interior white patch fully opaque
after the model-guard merge, leftover edge-connected backdrop fully removed, and
opaque interior pixels byte-identical to the source. Existing `flatCut` /
`bgAnalysis` / `finalTouch` suites must stay green.

**Verification**

`bunx vitest run src/lib/games`, `tsgo`, then a signed-in browser pass: re-cut
one of the glitching buildings, confirm no white rim at 1× and zoomed, and
compare against the first "morden building" on the rotating homepage.
