# Hallway navigation + locked-door interaction

Keep the lock system, its look, the hallway design, junctions, camera style and room logic exactly as they are. Only the movement/interaction logic changes, plus the new teacher attempt setting.

## 1. Root cause of "Forward enters the first door" (confirmed)

The 3D scene's pointer event source is the wrapper `<div>` that also contains the navigation overlay (`WalkControls`) and, when a lock is showing, the keypad overlay. So a pointer press on the Forward button bubbles into that same element, React Three Fiber raycasts it against the scene, and the door under the crosshair receives a click — which runs the door's enter action. Pressing Forward therefore behaves like clicking the door ahead.

Fix (not by disabling controls):
- Stop overlay pointer events from reaching the scene: the controls overlay swallows its own `pointerdown/up/move/click` before they bubble to the event-source div.
- In the scene's pointer handling, ignore any event whose target is not the canvas itself.

Result: Forward only moves; a door is only entered by clicking the door.

## 2. Forward movement respects doors

- A door mid-hallway is never entered by walking. Walking past it stays walking (current behaviour once #1 is fixed).
- A locked door acts as a physical barrier at its own slot: the walker stops just short of the door's position instead of continuing past/through it, with a short cue ("Locked — click the door to enter the code"). Once the room's code is accepted, that stop is lifted and Forward passes the doorway and enters the room naturally.
- Unlocked doors keep entering the room the way they do today when clicked, and Forward through the doorway enters naturally.
- Backward, turn-around, junction and boundary/branch logic stay untouched.

## 3. Door click → focus the lock (not open)

New interaction states in the walker:
- LOCKED: clicking a locked door does not open it. The camera glides to a comfortable distance in front of the panel beside the door and looks at the panel (not at the door leaf), reusing the existing zoom mechanism rather than a new camera system.
- LOCK FOCUS: keypad is the active element; movement input is ignored while focused, and an "Exit" control returns the camera to the hallway and resumes normal navigation.
- UNLOCKED: on the correct code the panel shows its unlocked state, the door unlocks, the camera glides back to face the doorway and the student stays outside. Forward then takes them in. Entry is no longer automatic after unlocking.

## 4. Keypad is digits only

The lock becomes a 10-digit panel (0–9) everywhere: creation, editing and the wall panel. The letters/alphanumeric options are dropped from the lock settings and the panel keypad, so teachers set a numeric code such as `4729`. Existing non-numeric locks keep working for verification but display the numeric keypad.

## 5. Wrong code

No door opening; the panel turns red and reads WRONG CODE with the remaining attempts when a limit is set. The camera stays focused on the lock so the next attempt is immediate.

## 6. Optional teacher attempt limit

Added to the room's Lock settings (and the optional Lock step of Add Room), off by default:
- Maximum attempts (e.g. 3)
- Retry after (a duration, e.g. 24 hours)

With the setting off there is no limit. With it on, each wrong submission counts; at the maximum the panel refuses further input and shows "Maximum attempts reached. Try again in 24 hours", counted per student and enforced on the server so it cannot be bypassed by reloading.

## Technical notes

- `src/components/academy/world/HallwayScene.tsx`: overlay/canvas event isolation; lock-aware stop distance in the walk frame loop; new `lockFocus` walker state driving the existing zoom to the panel and back; door click routed to focus-lock instead of `guardedEnter`; unlock no longer runs the pending entry callback.
- `src/components/academy/world/DoorLockPanel.tsx`: numeric keypad only, WRONG CODE / attempts-exhausted messaging, exit affordance.
- `src/lib/building/lock.ts`: keypad/charset contract narrowed to digits; attempt-policy helpers.
- Migration: add `max_attempts int null` and `retry_after_minutes int null` to `building_room_locks`, plus a `building_room_lock_attempts` table (room, user, wrong-attempt count, window start) with grants and RLS so a student only sees their own row.
- `src/lib/building/lock.functions.ts`: `verifyRoomLock` records failures, enforces the limit and returns remaining attempts / retry-at; `setRoomLock` accepts the optional policy.
- Editor surfaces: `RoomLockSettings.tsx`, `WalkwayManager.tsx` lock step.
- Verification: typecheck, navigation/lock tests, then an authenticated pass through the hallway confirming Forward walks without entering, a locked door blocks, clicking focuses the panel, a wrong code shows red, and a correct code leaves the student outside an open door.
