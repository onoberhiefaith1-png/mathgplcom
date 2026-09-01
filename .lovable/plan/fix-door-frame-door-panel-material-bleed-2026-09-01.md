# Fix door frame / door panel material bleed

The frame stays exactly as it is. The problem is in the door panel's material: the panel is currently tinted with the frame's accent colour, so the frame's look bleeds into the door artwork.

## What is happening now

In the door component (`DoorMesh` in `src/components/academy/world/HallwayScene.tsx`):

- The frame jambs, lintel and threshold use the accent colour — correct, keep.
- The door panel plane uses the SAME accent colour as its emissive glow (`emissive={accent}`), and on hover that glow is boosted up to 4x. So the frame's colour is literally added on top of the imported door image, washing it into the frame.
- The recess plane behind the panel is painted with the door design colour, which is the reverse of the intended layering.

## The fix (panel only)

1. Door panel material becomes independent of the frame:
   - remove the accent emissive from the panel; when a door image is present the panel renders the image as-is (white base colour, neutral emissive at near-zero) so its own colour, glass, transparency and lighting details survive.
   - flat (no image) doors keep using the door design colour, not the accent.
2. Hover feedback moves off the panel's colour: hover brightens the FRAME only (it already has its own emissive lerp), so pointing at a door never repaints the door artwork.
3. Recess plane behind the panel uses a neutral dark shadow tone instead of the door design colour, so the doorway reads as depth and the panel is the only surface showing the door design.
4. Keep the panel strictly inside the opening (unchanged `leafW`/`leafH` against `jambW`), so the frame remains a visible border on all sides with clean separation.

Result: changing the door design changes only the panel; changing the frame accent changes only the frame.

## Verification

Render the junction/hallway with several different door styles (navy vision, charcoal full glass, oak, steel wired, glass entrance) plus a custom uploaded door, at rest and hovered, and confirm the panel keeps its original artwork with no accent tint and the frame border stays intact.

## Files touched

- `src/components/academy/world/HallwayScene.tsx` — `DoorMesh` panel material, hover lerp target, recess plane colour. No other component, no data model, no editor changes.
