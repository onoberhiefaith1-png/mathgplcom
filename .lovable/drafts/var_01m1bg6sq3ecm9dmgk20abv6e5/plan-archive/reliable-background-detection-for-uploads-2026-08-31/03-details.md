## Technical detail

### `src/lib/games/removeBackground.ts` — rewrite `detectMediaBackground`

Current logic: one frame, 8 point samples, `keyable = variance < 40`.

New logic:
- **Frame sampling.** For video, decode and grab up to 3 frames (~10%, 50%, 90%
  of duration, guarded by `readyState`/`seeked` with a timeout so it can never
  hang); for images, one frame. Draw scaled down to max 320px wide for speed.
- **Border ring.** Sample all pixels in a ring of ~8% of width/height around the
  frame edge (plus the four corners weighted), not 8 lone points.
- **Clustering.** Quantise ring pixels into 24-level RGB buckets, pick the
  dominant bucket, then recompute its mean colour from member pixels. Compute
  `coverage` = fraction of ring pixels within a tolerance of that mean.
- **Verdict.** Return `{ color, keyable, coverage, spread, reason }`:
  - `coverage >= 0.7` and `spread` (mean distance within the cluster) below a
    shading-tolerant limit → `keyable: true`.
  - Near-white / near-black / low-saturation greys get a wider `spread` limit,
    because studio white backdrops fall off in brightness towards the corners.
  - Otherwise `keyable: false` with a short `reason` string.
- Keep the exported `KeyColor`/`BgDetection` shape backwards-compatible (add
  fields, don't remove); existing callers in `SettingsPanel.tsx`,
  `GameEditorPage.tsx`, `AdventureGameEditor.tsx` and `videoChromaCut.ts` keep
  working unchanged.

### `src/lib/games/videoChromaCut.ts`

- Accepts the richer detection result; when the caller supplies an explicit
  `keyColor` (manual override) detection is skipped, as today.
- For low-saturation keys (white/grey/black) widen the luma-based band slightly
  so white cuts cleanly without eating light subject areas — the shader already
  has a luma fallback branch; only the band constants per softness are tuned.

### `src/components/assets/manage/AssetFormDialog.tsx`

- Replace the single `keySwatch` string with a small state machine:
  `idle | checking | detected | not-flat`, so "checking…" no longer doubles as
  the failure state.
- Render the detected swatch plus a one-line confidence note, or the
  not-flat reason with the existing "the original video is stored untouched"
  wording.
- Add a "Pick the background colour" control: a canvas preview of the first
  sampled frame; clicking reads that pixel and sets a manual `keyColor` which is
  passed into `cutVideoBackground`, overriding detection (including for
  `not-flat` clips).
- Images keep using `makeTransparent` unchanged.

### Verification

- Unit tests for the new detector against generated canvases: flat white, white
  with a corner gradient, white with the subject touching an edge, green screen,
  and a busy photographic background — asserting verdict and key colour.
- Typecheck plus the existing game/media test files.
- Browser check of the Add Asset dialog with a white-background clip: state moves
  from *Checking…* to a white swatch, and the manual picker sets the colour.
