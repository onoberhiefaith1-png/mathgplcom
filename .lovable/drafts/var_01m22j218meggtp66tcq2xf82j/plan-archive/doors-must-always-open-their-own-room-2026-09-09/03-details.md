## Technical detail

Confirmed by reading the current code:

- `src/components/academy/world/HallwayScene.tsx` holds entry across `pendingEntryRef` (2809), `enterClassroom` (3321), `commitEntry` (3361), `cancelPendingEntry` (3369), `openDoorRoom` (3876) with a 1500 ms watchdog, and `startDoorZoom` (3200) whose `onDone` also commits. `backToBrowse` (≈2963) silently discards a pending entry.
- The legacy Academy layer is still present in the same component: the `rooms?: AcademyRoom[]` prop (2556), `rootRoomObjects` injected as doors (169, 213), the carousel/focus handlers (3563–3690, 4103) and the auto-walk skip at 3567. `void rooms` at 1949 shows it is already vestigial.
- `roomForDoor` / `indexRoomsByDoor` in `src/lib/building/classroom.ts` are correct and stay.

### Rewrite

1. Delete the pieces above (pending ref, watchdog timer, zoom-coupled commit, legacy `rooms` prop and carousel/showroom wiring inside the building scene, `rootRoomObjects`).
2. New pure module `src/lib/building/entry.ts`:
   - `resolveEntry({ door, roomsByDoor, front })` → `{ room, doorWorld, into }` or a typed `no-room` result. Strict identity check `room.door_id === door.id`, no fallback.
   - `initialStance(kind)` → the inside `x`, `z`, `yaw` (moved out of `enterClassroom`).
   - Unit tests in `src/lib/__tests__/buildingEntry.test.ts`: correct room, wrong/absent door id, repeat click idempotence, stance bounds per room kind.
3. `HallwayScene` gets one handler: resolve (with a single DB re-read when the loaded page is stale), then set `insideRoom` and `machine.inside` immediately, then start the cosmetic glide. No timer, no deferred commit, so no path can cancel or redirect it.
4. Lock gate unchanged: `guardedEnter` still routes a locked door to keypad focus; a correct code calls the same single entry handler.
5. Exit remains `leaveClassroom`, restoring the stored hallway segment and distance. `onExitBuilding` stays wired only to the entrance door and the top-bar Building button.

### Verification

- `tsgo` typecheck plus the new entry tests and existing `buildingClassroom` / navigation tests.
- Authenticated browser pass: open the building, click each of the first doors, assert the room name overlay matches the clicked door's room and that the URL never leaves the building page.
