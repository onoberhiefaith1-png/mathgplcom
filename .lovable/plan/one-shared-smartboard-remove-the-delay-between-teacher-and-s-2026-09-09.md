# One Shared Smartboard — remove the delay between teacher and student

## What I found (confirmed, not guessed)

The board already sends tiny per-field changes over a live socket every 40ms — the architecture you describe mostly exists. But **the live channel is never actually allowed to open.**

- The class board joins its live room in *private* mode (`src/lib/stability/useLiveChannel.ts:54`, default `private: true`).
- A private live room is only allowed if the message table has access rules. I queried the backend: row security on `realtime.messages` is **on** and there are **zero policies**.
- Result: every join is refused, no live message is ever delivered, and the only paths left are the durable copy (written after a 1200ms delay, then read back through change events) and the 20-second safety poll (`useSmartboardSync.ts:47,209`). That is exactly the multi-second lag you see.

Second gap: the class board replicates ink, boxes, lines, cursor, zoom, surface and colours — but **not the floating-number activation state** (`activeLineIdx` exists only in the assessment session, `useAssessmentBoardSession.ts:27`). So "the teacher touches floating number 27 and the student's 27 wakes up behind the scenes" cannot happen today, even with a fast socket.

## What I will change

### 1. Open the live room (the actual fix for the delay)
Add access rules for live-room messages so a signed-in participant of a class may read and write messages on that class's board room, and nobody else can. Same for the assessment board rooms and the audience rooms already in use. This alone turns delivery from ~5-20 seconds into tens of milliseconds, because the fast path is already written.

### 2. Make the fast path the only path for visuals
- Keep the database write, but strictly in the background (nothing on screen waits for it).
- Keep the 20-second safety poll as a reconnect net only, and stop it from overwriting fresher live state.
- Make a rejoin ask the current owner for one full board (the `hello` handshake already exists) so a dropped connection recovers instantly instead of on the next poll.

### 3. Same floating number on both ends
- Add the floating-workspace fields (active line, active tag/chip selection, panel open state, container kind) to the shared board state so operating a floating number on one side operates the very same one on the other side — hidden on the student side while the teacher holds control, already live so it needs no rebuild when control is handed over.
- Granting a student control changes permission only; it must not create or reload anything.

### 4. Order, recovery, no artificial waiting
- Keep per-sender sequence numbers (already present) and keep the send cadence at one frame (~40ms leading edge) — no debounce on teaching interaction.
- On reconnect: full-state request, then resume incremental changes.

## Not changing
Smartboard UI, layout, controls, maths, writing behaviour, lesson notes, guest links, the building/academy system, camera, map.

## Technical notes
- Migration: policies on `realtime.messages` scoped by `realtime.topic()` matching `sb-sync-<classId>` / assessment / audience room names, checking class membership or ownership through existing helper predicates; signed-in roles only.
- `useSmartboardSync.ts`: extend `BoardState` with the floating fields, remove poll-over-live overwrite, keep persist async.
- `PresentationView.tsx`: publish/apply the new floating fields alongside existing ones (same two effects at lines ~1313 and ~1334).
- Verification: authenticated two-window check (teacher + student in the same class), confirm the live room joins (`SUBSCRIBED`), and measure that a keystroke appears on the student board in well under a second.
