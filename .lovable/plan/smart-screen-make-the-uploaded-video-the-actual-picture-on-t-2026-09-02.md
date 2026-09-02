# Smart Screen — make the uploaded video the actual picture on the glass

## What is wrong today

The audio plays because the video element loads and plays correctly. The image never appears because of how the screen's glass surface is built.

The glass is a rounded-rectangle shape whose texture coordinates run in metres (roughly -2.1 to +2.1 across a 4.2 m panel) instead of the 0-to-1 range a video texture needs. The video frame is therefore sampled far outside its own image and the panel shows one flat edge colour — indistinguishable from the old dark screen. Nothing about upload, storage, playback, navigation or the screen's position is broken.

## The fix (rendering only)

1. Give the glass proper texture coordinates
   - Normalise the glass geometry's UVs to 0..1 across the panel, so a video frame maps exactly once onto the visible surface.
   - Because the screen group is rotated to face the room, mirror the horizontal axis so text in the video reads correctly rather than reversed.

2. Fit the picture to the panel without stretching
   - Once the video reports its natural width/height, apply a cover-style fit (centre-crop) through the texture's repeat/offset so a 16:9 lesson video fills the 16:9 glass exactly and any other ratio is centred instead of squashed.

3. Keep the frame behaviour already agreed
   - No video: dark standby glass, housing, bezel and caption.
   - Video present: housing, bezel and caption stay hidden; the picture itself is the screen.

4. Make sure frames actually flow
   - Ensure the video texture refreshes every rendered frame and that the material's map/emissive map are re-bound whenever the video element or its metadata changes.
   - Drop the `crossOrigin` attribute requirement issue by keeping the storage URL same-origin-safe for texture use, so a frame is never rejected as tainted.

## Explicitly unchanged

Classroom dimensions, walls, floor, ceiling, doors, room navigation and movement controls, camera behaviour, Smart Screen position and size, the Edit-mode upload/replace/remove panel, autoplay-on-entry (muted, viewer can unmute), viewer video controls, and the 10-second inactivity auto-hide. Walking closer already enlarges the screen through real 3D perspective; no digital zoom is added.

## Files touched

- `src/components/academy/world/SmartScreen.tsx` — UV normalisation, mirroring, cover-fit, texture refresh.
- `src/hooks/useRoomScreen.ts` — only if the video element needs a metadata signal or a cross-origin adjustment for texture use.

## Verification

Type check, then sign in, enter a room with an uploaded video in View mode, and confirm from a screenshot at the back of the room and again close to the wall that the moving picture is on the glass, the dark placeholder is gone, and the screen grows naturally as you approach.
