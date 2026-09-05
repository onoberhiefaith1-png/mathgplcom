# Live test: set a lock code on a real door, then unlock and enter

## What I found so far

- Your building currently has exactly one locked room: **erw** (4-digit code, 3 attempts, 24-hour wait). No failed attempts are on record, so nothing is blocking you right now.
- The code is saved and checked with the same rule (spaces trimmed, uppercase, tied to the room), so the stored code and the typed code should match. That means the failure is most likely in what happens on the page itself — the keypad, the "UNLOCKED" step, or the door opening afterwards — not in how the code is stored. I will confirm this live rather than guess.

## What I will do, step by step, on the real site

1. **Sign in as you** (the browser session I already have) and open the editor.
2. **Set a fresh lock through the normal screen** — Environment settings → Lock on the erw room: type the code twice, save. I will use `2580` and tell you the exact code I set. I will do this through the same button you use, not by editing the database, so it tests your exact path.
3. **Confirm it saved** — read the lock back (length 4, digits, updated just now, zero attempts).
4. **Walk to the door as a visitor** in the building view, click the door, and check the camera lands on the keypad with the numbers `1–9`, `*`, `0`, `#` visible.
5. **Type the code on the keypad** one key at a time, with a screenshot after each press so we can see the dots fill. Confirm the panel says **UNLOCKED**.
6. **Confirm the door opens the right room** — after UNLOCKED, the walker should end up inside erw with "Leave through the door" showing. If Forward is still needed, I press Forward and check again.
7. **Test a wrong code too** — confirm it shows WRONG CODE, stays closed, and a retry works.
8. **Reset the lock to the code you want** at the end (or leave `2580` — your choice).

## If any step fails

I will stop at the failing step, take a screenshot, find the exact cause, fix it, and rerun from step 4. Likely suspects I will check first:

- Key presses being lost while the camera is still moving to the keypad.
- The page not picking up a newly saved code until it is reloaded.
- The "open" action after UNLOCKED pointing at a stale door.
- The visitor view not knowing the room is locked (lock list not loaded for the door).

## Technical notes

- Editor path: `RoomLockSettings` → `setRoomLock` (server) → `building_room_locks` upsert keyed by `classroom_id`; attempts row cleared on save.
- Visitor path: `HallwayScene` `guardedEnter` → `lockViewFor.onKey` → auto-submit at full length → `verifyRoomLock` → `unlockedRooms` + `open()` after 900 ms.
- Verification with authenticated Playwright at `1280×1800`, screenshots per step; then `bunx tsgo --noEmit` and `bunx vitest run src/lib/building` if any code changes.
- Nothing else changes: no door redesign, no navigation, room, map or environment changes.
