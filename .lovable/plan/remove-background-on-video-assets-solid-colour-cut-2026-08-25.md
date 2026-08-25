# Remove background on video assets (solid-colour cut)

Today the Add Asset editor's "Remove background" only works on images; video files pass through untouched. This adds a careful, quality-preserving cut for videos with a solid-colour background (green, black, white, or any flat colour).

## What changes for you

- In the asset editor, the option becomes **Remove background (images and solid-colour videos)**.
- When a video is selected with the option on, the editor:
  1. samples the video's first frame and detects the flat background colour,
  2. shows a small preview swatch with the detected colour and an **Edge softness** slider (Tight / Normal / Soft),
  3. cuts the background out frame by frame at the video's own resolution and frame rate, then stores a transparent WebM.
- Progress is shown as "Cutting background — 42%", with a **Cancel** button. The original video is never overwritten; the cut version is stored as a new asset marked transparent.
- If the background is not flat enough to cut safely, the editor says so and stores the original video untouched rather than damaging it.

## Quality rules

- Same width, height and frame rate as the source — no downscaling, no re-framing.
- High-bitrate VP9 with alpha (or VP8 alpha fallback), so the subject's detail, edges and colour stay as they were.
- Only pixels near the detected background colour are made transparent; a narrow feather band keeps hair, wings and thin edges from getting a hard fringe, and a small de-fringe step removes residual green/colour spill.
- Audio is preserved.

## Technical notes

- New module `src/lib/games/videoChromaCut.ts`:
  - reuses `detectMediaBackground` (already in `src/lib/games/removeBackground.ts`) to pick the key colour and confirm `keyable`;
  - plays the source video into an offscreen canvas, per-frame chroma-keys in a WebGL fragment shader (YCbCr distance keying with soft `edge0/edge1` thresholds + spill suppression) for speed and edge quality;
  - captures `canvas.captureStream(fps)` plus the source audio track and encodes with `MediaRecorder` at `video/webm;codecs=vp9` (falls back to `vp8`), `videoBitsPerSecond` derived from resolution (≈0.15 bits/px/frame, floor 6 Mbps) so quality is retained;
  - exposes `cutVideoBackground(file, { softness, signal, onProgress }): Promise<File>` returning a `.webm` file, and throws a typed `NotKeyable` error when detection reports a busy background.
- `src/components/assets/manage/AssetFormDialog.tsx`: extend the existing `removeBg` branch — images keep `makeTransparent`, videos call `cutVideoBackground`; add the detected-colour swatch, softness selector, percentage step text and cancel via `AbortController`; asset type becomes `transparent` on success, stays `video` on the not-keyable fallback.
- No storage/schema changes: the produced file goes through the existing `saveNew` upload path in `OfficialAssetSection.tsx`.
- Browser note: transparent-WebM playback works in Chrome/Edge/Firefox; Safari does not render WebM alpha, so the dialog notes that transparent video is for Chromium/Firefox boards.
- Scope: new uploads only, per your answer — existing stored videos are unchanged.
