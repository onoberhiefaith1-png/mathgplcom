# Building Map Starts at the Bottom of the Box

## The problem

Right now the map window always centres on the walker, so at the moment you enter the building the entrance sits halfway up the panel and the whole bottom half of the box is empty wasted space. The plan should begin at the bottom edge of the box and read upward (south to north), exactly like a floor plan pinned to a wall.

## What changes

- When you enter, the entrance/start of the main hallway is drawn at the **bottom edge** of the map box, with a small breathing margin only.
- As you walk north, the map still follows you (GPS style) — but it never scrolls further down than the building's starting point, so no empty space ever appears below the entrance.
- The same clamp applies sideways: the map won't drift past the outer edges of the building when the building is narrower than the box.
- Zooming keeps this behaviour: at every zoom level the entrance stays anchored at the bottom until you have walked far enough for the follow window to take over.

Nothing else about the map changes — same fixed panel size, same +/- zoom, same route highlighting, same player chevron.

## Technical notes

In `MiniMap` inside `src/components/academy/world/HallwayScene.tsx`:

- Return the building's map-space bounding box (`spanW`, `spanH` in map pixels) from the existing `svg` memo, alongside `px`/`py`.
- Replace the unconditional follow offsets

  ```ts
  const viewX = svg.W / 2 - ax;
  const viewY = svg.H / 2 - ay;
  ```

  with clamped offsets: compute the centre-follow value, then clamp so the drawing's bottom edge is never above `svg.H - PAD` and its top edge never below `PAD` (and the same for left/right). When the building is smaller than the panel in an axis, pin it to that axis's start edge (bottom for vertical, centred for horizontal).
- Keep the marker easing and the zoom-change snap untouched, so movement stays smooth.
