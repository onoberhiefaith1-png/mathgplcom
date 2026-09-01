# Fix swapped left/right controls inside a room

## Problem

Inside a classroom / teaching hall / auditorium, the left controls act as right and the right controls act as left: pressing "Turn left" (↰ / ArrowLeft / A) rotates the view to the right, "Turn right" (↱ / ArrowRight / D) rotates it to the left, and the two step buttons (◀ / ▶) move the opposite way too. Forward and backward work correctly.

## Root cause

The free first-person room walker in `src/components/academy/world/HallwayScene.tsx` (the `"inside"` phase of `CameraRig`) mirrors the horizontal axis:

- Turning: the controls send `turning = -1` for left and `+1` for right, and the walker integrates `w.yaw += w.turning * ROOM_TURN_SPEED * dt`. With the walker's forward formula `(sin(yaw), cos(yaw))`, an increasing yaw swings the view toward room-local `+x`, which is the **left** side of the screen when looking into the room from the door. So the right key turns the view left (and vice versa).
- Stepping: `strafe = +1` (step right) moves along `(cos, -sin)`, i.e. room-local `+x` — again the view's **left**. So step-right moves left.
- The drag-to-look handler already uses the correct direction (`w.yaw -= dx * 0.005`, so dragging right turns right), confirming the intended convention: **decreasing yaw = turning right**.

The room's own geometry, the building map, hallway navigation, and all input bindings are consistent; only the walker's two horizontal-direction formulas are mirrored.

## Fix

Two sign corrections in the room walker (`src/components/academy/world/HallwayScene.tsx`, ~line 1725 and ~lines 1741-1744):

1. Turn integration: `w.yaw += w.turning * ROOM_TURN_SPEED * dt` becomes `w.yaw -= w.turning * ROOM_TURN_SPEED * dt`.
2. Strafe motion: replace `(cos, -sin)` with the view's actual right vector `(-cos, sin)`:
   - `nx += cos * w.strafeSpeed * w.strafe * dt` becomes `nx += -cos * w.strafeSpeed * w.strafe * dt`
   - `nz += -sin * w.strafeSpeed * w.strafe * dt` becomes `nz += sin * w.strafeSpeed * w.strafe * dt`

Nothing else changes: keyboard bindings, on-screen buttons, drag-look, room geometry, the building map, and the hallway walker all stay exactly as they are. After the fix the existing type comments become true (`turning: -1 = turn left, 1 = turn right`; `strafe: -1 = left, 1 = right`).

## Verification

- `bunx tsgo --noEmit -p tsconfig.json` passes.
- Authenticated browser check at 1280x1800: enter a room, then confirm with both keyboard and the on-screen buttons that:
  - ↰ / ArrowLeft / A turns the view left; ↱ / ArrowRight / D turns it right.
  - ◀ steps left; ▶ steps right.
  - ▲ / ▼ (forward/backward) still work unchanged.
  - Drag-to-look still turns the view with the drag.