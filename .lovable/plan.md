# Smart Screen: make the video actually visible on the wall

## What is wrong

Inside the room the lesson video plays (audio and timeline run) but nothing is seen on the teaching wall — only blank wall and the nameplate.

Cause, confirmed in the code: the screen group is placed at `z = wallZ - 0.06`, then rotated 180°, and the glass sits at local `z = -0.075`. After rotation that resolves to `wallZ + 0.015` — i.e. 1.5 cm **behind** the teaching wall plane, which is opaque and faces into the room. The placeholder bezel/housing was thick enough to poke through, so the empty screen was visible; the bare video glass is not. The nameplate uses the opposite sign, which is why it shows.

## The fix

1. **Move the screen in front of the wall.** Correct the sign of the screen group / glass offsets in `SmartScreen.tsx` so the glass, bezel, housing and standby caption all end up a few centimetres *inside* the room (toward the viewer), with the glass the frontmost layer. Keep the same wall, height and size — only the depth sign changes.
2. **Video is a plain panel matching the screen.** Drop the cover-fit centre-crop: the video should fill the panel exactly, one frame across the whole surface (`repeat 1,1`, no offset), and the panel itself takes the video's own aspect ratio, sized to fit inside the existing screen envelope. Result: a flat rectangular video panel on the wall, nothing cropped, nothing stretched.
3. **Keep the panel clickable** (upload/replace in Edit mode, playback in View mode) and keep the soft glow light in front of the glass rather than behind the wall.

## Untouched

Room geometry, walls, floor, ceiling, lighting design, nameplate, classroom navigation, video controls, upload/storage flow and the Building Map.

## Technical notes

- File: `src/components/academy/world/SmartScreen.tsx` only.
- Replace the `coverFit`-style `texture.repeat/offset` block with identity mapping; derive panel width/height from `frameSize` clamped to `screenMount(kind)` width/height.
- Verify at 1280×1800 in the authenticated preview: enter a room with an uploaded video and confirm the moving picture is on the wall.
