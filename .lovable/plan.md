# Free movement inside a classroom

Right now entering a room freezes the camera at one fixed pose facing the front wall, and the only control is a "Leave classroom" button. Inside a room the navigation should change into free first-person movement: walk forward/back, step left/right, and look around the whole room. You exit by walking back out through the door — not by pressing a button.

## What changes

**1. A new room navigation mode**

Entering a room switches the camera into a *room walker* instead of the fixed pose:
- own position (x, z) and yaw inside the room's local space, starting just inside the door facing the front wall
- movement is delta-time based with smooth ramp-up/ramp-down, same feel as corridor walking
- the room walker keeps the hallway position untouched, so leaving resumes the corridor walk exactly where it stopped

**2. Controls inside the room**

Replaces the "Leave classroom" button with a room control cluster:
- Hold ▲ / ▼ — walk forward / backward along the way you are facing
- Hold ◀ / ▶ — turn (look) left / right, so you can turn all the way round
- Keyboard: W/S or ↑/↓ to walk, A/D or ←/→ to turn; Q/E to strafe sideways
- Drag on the canvas to look around (mouse / touch), so turning is not button-only
- The room name pill stays; a small "walk back through the door to leave" hint appears on entry

**3. Walls and exit**

- The walker is clamped inside the room's footprint with a small margin, so you never pass through walls or the ceiling; the camera stays at standing eye height and steps up/down with auditorium tiers
- Walking into the doorway opening at the back of the room leaves the classroom and hands control back to the corridor walker, facing back into the hallway
- An explicit "Leave" control stays available as a fallback for a user who has turned round and lost the door

## Technical notes

- `Machine.inside` in `src/components/academy/world/HallwayScene.tsx` becomes a small room-walker state (`origin` door, `heading`, `kind`, local `x`, `z`, `yaw`, `hold`, `turn`, `speed`) instead of a fixed `{ position, look }`.
- The `inside` branch of `CameraRig`'s `useFrame` integrates that state each frame, converts local room coordinates to world using the door position + heading (same transform `ClassroomShell` uses), and clamps against `classroomDimensions(kind)` from `src/lib/building/classroom.ts`, including per-tier floor height for the auditorium.
- `classroomEntryPose` stays as the entry seed (start position + initial yaw); the free walk continues from it.
- New `RoomControls` overlay component next to `WalkControls`, rendered when `insideRoom` is set; pointer-drag look handled on the existing canvas wrapper only while inside.
- Exit triggers `leaveClassroom()` when the walker's local z drops below the doorway threshold.

Scope: camera/controls only. No change to room geometry, materials, lighting, doors, corridors, labels, Building Map, editor, or settings.
