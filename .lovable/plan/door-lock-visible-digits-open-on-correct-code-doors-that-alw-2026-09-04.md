# Door lock: visible digits, open on correct code, doors that always open

## What is wrong today

1. **Blank keypad.** The keypad's numbers, the "ENTER ACCESS CODE" title and the padlock icon are all drawn with the same 3D text engine that the door plaques use. On the lock panel that text is not appearing at all, so the keys are empty tiles. The tiles and dots (plain shapes) do show, which points at the text engine failing for this panel, not the layout. A related crash ("d is not defined") is also being reported by the preview and most likely comes from that same text engine's background worker.
2. **Correct code only unlocks.** Entering the right code shows UNLOCKED and steps the camera back, but the door stays closed until it is clicked again.
3. **Door clicks get dropped silently.** A click on a door is thrown away when: the walker is mid-turn or mid-zoom, the click lands closer than 0.6 m, or the "does the door face me" test fails at an oblique angle. Nothing tells the student why, so it reads as "the door does not open".

## What will change

### 1. Keypad legends that can never go missing

- Draw the digits and labels onto the panel with a **2D canvas texture** generated in code (no font download, no worker, no async step). Layout stays exactly as asked:

```text
 1  2  3
 4  5  6
 7  8  9
 *  0  #
```

- `*` shows a small **CLEAR** caption, `#` shows **ENTER**.
- Title ("ENTER ACCESS CODE" / "WRONG CODE" / "UNLOCKED" / "LOCKED OUT"), caption and the padlock icon are drawn the same way, so the whole panel is legible immediately.
- Key faces stay the same size and position, so the existing click handling (whole key is the button) keeps working.
- Door plaques and hallway frames are not touched.

### 2. Correct code opens the door straight away

- On a correct code: panel shows UNLOCKED (green) for a moment, the camera returns from the keypad to face the doorway, and the door then opens into its room automatically — the same zoom-and-enter used by an unlocked door.
- The room stays unlocked for the rest of the visit, so coming back out and clicking the door again opens it without the code.
- Wrong code and lock-out behaviour are unchanged (red WRONG CODE, retry, attempt limit).

### 3. One "force open" path for every door

A single `openDoor(doorId)` routine that every door click goes through, designed so a click is never lost:

- **Never refuse a click because of animation state.** If the walker is turning, zooming or at a keypad, the current animation is cancelled and the door opens from where the camera is.
- **Simpler "can I see this door" rule.** Classroom doors accept a click whenever the door is in front of the camera and within the current or adjoining hallway; the 0.6 m minimum distance and the strict facing test are kept only for the entrance door (the case they were added for).
- **Room lookup that cannot pick the wrong room.** Cache first, database second, and the opened room must carry this exact door's id; otherwise a clear message says the door has no room.
- **Locked doors** go to the keypad (camera focus) instead; **unlocked doors** open immediately.
- **No silent failures.** Any refusal shows a short on-screen message ("Move a little closer", "This door has no room yet") so it is always clear what happened.

### 4. Fix the text-engine crash

- Trace the "d is not defined" error to its source (expected: the 3D text library's background worker under the dev bundler). Fix by keeping the library out of dependency pre-bundling or running its text builder on the main thread, whichever the trace confirms. Plaques will then render reliably too.

## Verification

- Sign in, walk to the ERW door, click it: keypad shows digits 1–9, `*` 0 `#` with CLEAR/ENTER.
- Enter a wrong code: red WRONG CODE, keypad stays usable.
- Enter `4729`: UNLOCKED, camera returns to the door, room opens.
- Leave the room, click the same door again: opens without the code.
- Click three other unlocked doors from different distances/angles: each opens its own room; none navigates elsewhere.
- Preview console shows no "d is not defined" error.

## Technical notes

- `src/components/academy/world/DoorLockPanel.tsx`: replace drei `Text` legends with a `CanvasTexture` atlas (one texture for the face: title, caption, icon; one small texture per key or a shared atlas with per-key UV offsets). Keep key groups, `NO_PICK` outlines, glow states and props unchanged. `keypadRows` in `src/lib/building/lock.ts` already yields the required layout.
- `src/components/academy/world/HallwayScene.tsx`:
  - `lockViewFor` success branch: after the 900 ms UNLOCKED display, call `releaseKeypad()` then `openDoorRoom(door, world, front, visual)` for the door the panel belongs to (pass door context into the lock view).
  - New `openDoor` helper wrapping `guardedEnter` + `openDoorRoom`; `startDoorZoom` no longer early-returns on `turning`/`zooming` — it cancels the in-flight animation and starts the zoom.
  - `doorFacesCamera` applied only for `atStart` doors; classroom doors use a camera-forward dot test plus `nearbyIds` membership. Raycaster `near` stays as is for the entrance-door case.
  - Toasts for refused clicks via the existing `toast`.
- `vite.config.ts` / text builder: after confirming the stack trace, either add `troika-three-text`, `troika-worker-utils`, `troika-three-utils` to `optimizeDeps.exclude`, or call `configureTextBuilder({ useWorker: false })` once at scene mount.
- Add unit test for the keypad legend layout (`lock.test.ts`) and a resolver test that `openDoor` refuses a room whose `door_id` does not match.
