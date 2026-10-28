## Technical detail

**New module `src/lib/games/flatCut.ts` (pure, testable)**

- `buildBackgroundMask(frame, key, opts)` — scanline flood fill seeded from every
  border pixel whose distance to the key colour is inside `tolerance`. Uses a
  perceptual distance (chroma distance plus a luma term, matching
  `bgAnalysis.isLowSaturation` handling for white/grey/black keys) so soft studio
  falloff and JPEG noise still connect, while the building blocks propagation.
- Post-pass: remove mask specks smaller than a few pixels, close 1-px pinholes,
  then compute a `boundary` band (mask pixels adjacent to kept pixels).
- `featherAlpha(mask, boundary, radius)` — graded alpha across the band only
  (radius from the softness setting), so edges are smooth but not eroded.
- `despill(pixels, alpha, key)` — applied only where `0 < alpha < 1`; removes the
  key hue's contribution to the fringe. Fully opaque pixels are never modified.
- `protectInterior: false` falls back to today's global colour key, for the rare
  case where a subject really is meant to be punched through.

**Images — `src/lib/games/removeBackground.ts`**

- `makeTransparent(file, opts)` first runs `detectMediaBackground` on the image.
  When the backdrop is flat/keyable it uses `flatCut` at the image's native size
  and encodes lossless PNG (no downscale, no quality parameter).
- When the backdrop is not flat it falls back to the existing
  `@imgly/background-removal` model, unchanged, so photographic uploads keep
  working. `blobHasTransparency` still guards the result.
- Signature stays backwards compatible: existing callers
  (`HomepageBuildingPage`, `HomepageReplaceBuildingPage`, `assets.ts`,
  `AssetFormDialog`) keep working with no argument changes.

**Video — `src/lib/games/videoChromaCut.ts`**

- Add a second `sampler2D uMask` (R = keyable region) to the fragment shader.
  Final alpha = `max(existingSmoothstep, 0)` gated by the mask: outside the mask
  alpha is forced to 1, so interior whites can never be cut.
- The mask is produced on a small offscreen 2D canvas (~256 px wide) by
  `buildBackgroundMask`, dilated by 2 px, and re-uploaded every ~6 frames so a
  moving subject stays covered. Cost stays negligible at that size.
- Keep the current bitrate, dimensions, frame rate, audio routing,
  `NotKeyableError`, and manual `keyColor` override behaviour untouched.
- Narrow the low-saturation band widening (currently `×1.35`) back toward the
  base band, since connectivity now does the work that the wide band was doing.

**Dialog — `src/components/assets/manage/AssetFormDialog.tsx`**

- Keep the existing `idle | checking | detected | not-flat` states and the
  manual key-colour picker.
- Add, below the detection row: a checkerboard-backed preview of the cut first
  frame, a `Tolerance` slider (feeds `opts.tolerance`), and a
  `Protect colours inside the subject` switch defaulting to on. Preview
  recomputes with `flatCut` on the already-grabbed preview frame — no upload,
  no extra decode.

**Tests — `src/lib/games/flatCut.test.ts`**

Synthetic frames covering: white backdrop with a white patch inside the subject
(patch survives, backdrop goes); green screen with green on the subject; subject
touching a frame edge; shaded/gradient white backdrop; a 1-px gap that must not
leak the fill into the subject; feather band produces intermediate alpha and
opaque interior pixels are byte-identical to the source.

**Verification**

`bunx vitest run src/lib/games`, `tsgo` typecheck, then a browser pass in the
Add Asset dialog and on a building slot with a white-background building image:
confirm the cut-out keeps its white signage and shows no fringe over the dark
homepage.
