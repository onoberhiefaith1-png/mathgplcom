# Door Lock System — optional wall-mounted access panel

Build the lock as its own reusable component, then attach it to individual doors. Existing door design, hallway navigation, room system and Building Map stay untouched.

## What the user gets

**Edit mode (teacher/admin)**
- Selecting a door in the building editor shows a new "Access lock" section with **Add Lock**.
- Adding a lock asks for: the code, whether it uses numbers, letters or both, and code length (4–8).
- The lock can be edited (new code) or removed at any time. No lock = door behaves exactly as today.
- Locks are per door. There is no global code.

**View mode (student)**
- Clicking a locked door does not open the room. The 3D access panel beside the door lights up and asks for the code.
- Code entered on the keypad mounted on the wall — never a floating web modal.
- Correct code: the panel turns to its unlocked state (green glow, unlock icon), then the normal door zoom and room entry runs unchanged.
- Wrong code: panel stays locked, shows a brief "Incorrect access code" red state, indicators clear.
- An unlocked door stays unlocked for the rest of that visit; leaving and re-entering the building re-locks it.

## Visual direction

Following the reference image: compact dark bezel panel, navy-black face, cyan edge glow, padlock glyph, "ENTER ACCESS CODE" caption, four to eight round code indicators that fill as digits are typed, 3x4 keypad with `*` and `#`, thin light bar at the base. Mounted flush on the wall immediately to the right of the door leaf, at hand height, angled with the wall so it keeps its position and perspective as the camera moves or zooms.

## Technical notes

**Data**
New table `public.building_door_locks`, one row per door:
`id`, `building_id`, `door_id` (unique, FK cascade), `code_hash`, `charset` (`digits` | `letters` | `alphanumeric`), `code_length`, `created_by`, timestamps. Migration includes GRANTs, RLS enabled, and policies mirroring the existing building-edit rules (`can_edit_building`) for write; `SELECT` exposes only non-secret columns via a view/policy set so the plaintext code never reaches the client — the code is hashed and never selected.

**Verification**
`src/lib/building/lock.functions.ts` server functions:
- `setDoorLock` / `removeDoorLock` — auth + `can_edit_building` check.
- `verifyDoorLock({ doorId, code })` — hashes the attempt, compares, returns `{ ok }` only. Rate-limited per session to avoid brute force.
Read of lock existence/shape (`hasLock`, `charset`, `code_length`) comes with the building payload in `src/lib/building/api.ts`.

**Components (built and testable on their own first)**
- `src/components/academy/world/DoorLockPanel.tsx` — pure 3D panel: props `state` (`locked` | `checking` | `unlocked` | `error`), `filled`, `length`, `charset`, `onKey`, `onSubmit`, `onClear`. No knowledge of doors or rooms.
- `src/lib/building/lock.ts` — types, charset key layouts, code validation helpers, `hashCode`.
- Unit tests for the helpers plus a rendering smoke test.

**Integration**
- `DoorMesh` in `HallwayScene.tsx` accepts an optional `lock` prop and mounts `DoorLockPanel` as a child of the door group at `x = +(leafW/2 + 0.55)`, so it inherits the door's wall placement and orientation automatically. Door geometry, materials and nameplate are unchanged.
- `openDoorRoom` gains a gate: if the door has a lock and is not yet unlocked in this session, it focuses the panel instead of zooming. On `verifyDoorLock` success it calls the existing `openDoorRoom` path verbatim.
- Editor: `WalkwayManager.tsx` door row gets the Add/Edit/Remove Lock controls, wired through new handlers in `AcademyEditorPage.tsx`.

**Out of scope**
No change to door appearance, hallway navigation, door placement logic, classroom shell, Smart Screen, or Building Map.
