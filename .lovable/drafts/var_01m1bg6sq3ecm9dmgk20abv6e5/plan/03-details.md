## Technical detail

**New module `src/lib/games/finalTouch.ts`** (pure, testable):
- `scanRevolution(url, { frames })` — creates an offscreen `<video>`/image, seeks to N evenly
  spaced timestamps across the whole duration (default 18, capped by duration), draws each into a
  320px-wide canvas and returns `RawFrame[]`, reusing the existing seek/timeout safety in
  `removeBackground.ts` (`grabPreviewFrame` pattern) so a stalled clip fails instead of hanging.
- `tuneFromLoop(frames, current)` → `FinalTouchResult`:
  - key colour via `analyseFrames` from `bgAnalysis.ts` (already loop-capable),
  - for each candidate tolerance in a coarse-to-fine sweep, run `buildBackgroundMask` +
    `maskCoverage` from `flatCut.ts` on every frame; score = leftover backdrop coverage at the
    border ring + subject pixels lost; choose the smallest tolerance whose *worst* frame passes,
  - halo = mean chroma distance of the 2px boundary ring to the key colour → feather px,
  - flicker = per-pixel alpha delta between consecutive frame masks → raises feather and,
    above a threshold, raises tolerance one step for temporal stability,
  - seam = mean absolute difference frame[0] vs frame[N-1] → `loopFade` seconds (0–0.4),
  - blend: `screen` only when the agreed key colour is near-black and coverage is high;
    otherwise left as authored. Opacity never lowered.
  - returns per-issue verdicts (`fixed | reduced | not-fixable`) plus a reason string.

**Data (`src/lib/games/types.ts`)** — additive optional fields on `CanvasElement`:
`keyFeather?: number` (edge softness px), `loopFade?: number` (seconds), `finalTouch?: { at: string; frames: number }`.
Existing elements keep working; defaults preserve today's behaviour. No database migration —
these live inside the already-stored `customBuilding` JSON.

**Playback wiring**:
- `ChromaVideo.tsx` — accept `feather` and use it instead of the hardcoded `thr * 0.5`, so the
  measured halo width is what the shader/pixel pass actually applies.
- `RotatingAdventureScene.tsx` `CustomBuilding` — when `loopFade > 0`, drive the video with a
  short opacity crossfade timed to the end of the loop (CSS transition on the wrapper, no extra
  video element), which removes the restart flash. `customBlendStyle` unchanged.
- `videoChromaCut.ts` unchanged — Final Touch is settings-only per the chosen option.

**UI (`src/components/gamebuilder/SettingsPanel.tsx`)**:
- A "Final Touch" block in the existing background-removal section: primary button
  ("Scan one revolution"), progress text with frame count, and a result list with a tick or
  warning per issue. Toast on completion. Values are written through the existing `onChange`,
  so the sliders visibly move and remain hand-adjustable.
- Available for video buildings; for image buildings it runs a single-frame pass and reports
  that flicker/seam do not apply.

**Tests** — `src/lib/games/finalTouch.test.ts` with synthetic frame sets: stable white backdrop,
shifting backdrop between frames (flicker), backdrop with an interior white sign (must stay),
mismatched first/last frame (seam → `loopFade > 0`), and a photographic frame set that must
report `not-fixable` rather than an over-wide tolerance.

**Verification** — typecheck, the new plus existing `flatCut`/`bgAnalysis` suites, and a browser
pass on Replace Building running Final Touch on the current building, then confirming the
homepage revolution shows no halo/flicker/seam.

## Out of scope
No re-render or re-upload of the clip, no change to the rotating MathGPL geometry, speed control,
asset storage, or homepage save flow.
