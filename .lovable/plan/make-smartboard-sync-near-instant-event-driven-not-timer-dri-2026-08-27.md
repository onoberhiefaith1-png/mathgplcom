# Make Smartboard sync near-instant (event-driven, not timer-driven)

## Where the ~4 seconds actually comes from

I traced the whole teacher → server → student path. Confirmed in code:

1. Teacher board state is debounced 180ms, then **written to the database** (`class_smartboard_state` upsert).
2. Students learn about the change through `postgres_changes` (a database-replication event), then throw away the payload and do **another database read** to fetch the state.
3. There is a **safety timer** re-reading the row every 5s (teacher side) and every 4s (student page).

The critical finding: `class_smartboard_state` stores the entire board snapshot as one JSON blob (free lines, smart lines, boxes, offsets) and the table is set to `REPLICA IDENTITY FULL`. Realtime change events have a payload size ceiling — a real lesson board exceeds it, so the change event is **dropped silently**. The student never gets a live event at all; the 4-second safety timer is doing the actual delivery. That is exactly why it feels like a fixed 4s lag.

So the fix is not "lower the timer". The fix is to stop routing live updates through the database.

## The fix

Keep one pipeline, change its transport to a persistent WebSocket broadcast on the channel that is **already open** for each class:

- **Teacher publishes deltas over the socket.** Only the fields that changed are sent, with a sequence number, on a 40ms leading-edge throttle — the first action of a burst leaves instantly, the rest coalesce.
- **Student applies the delta locally**, merged onto its last known state. No database read on the live path.
- **Database becomes durability only.** The full snapshot is still saved, debounced ~1.2s, so reloads and late joiners get the board. It no longer gates live delivery.
- **Late joiners resync instantly.** On joining the channel a client sends a `hello`; whoever holds edit rights replies with one full snapshot.
- **Oversized frames stay correct.** If a delta would exceed the socket frame limit, it is persisted and a tiny `reload` ping tells peers to read the row — bounded, rare, and never silent.
- **Safety timer becomes a true safety net**, moved from 4–5s to 20s. It can no longer be the primary delivery mechanism.
- Active-student / control changes keep using the durable row (they are rare and need to be authoritative).

No separate system, no new tables, no migration. The hook's public API (`incoming`, `pushSnapshot`, `activeStudentId`, `setActiveStudent`) is unchanged, so `PresentationView` and the student page need no behavioural rewrite.

Expected result: teacher action → student screen in tens of milliseconds on a normal connection, instead of a fixed multi-second wait.

## Technical details

Files to change:

- `src/hooks/useSmartboardSync.ts` — replace the write-driven transport with broadcast send/receive: sequence numbers, per-field delta diffing, leading-edge 40ms throttle, `hello` full-snapshot handshake, `reload` fallback for oversized frames, debounced durable persist, poll interval 20s. Guard against stale/out-of-order frames and against echoing your own author id.
- `src/pages/student/StudentSmartBoardPage.tsx` — keep its realtime subscription for class access/notebook changes, but raise its 4s snapshot poll to 20s so it is a safety net rather than the delivery path.

Verification:

- Typecheck plus the existing smartboard/presentation test suites.
- A latency test: two browser contexts (teacher + student) on the same class, teacher writes, assert the student DOM reflects it well under 500ms — this is the check that proves the delay is gone rather than shortened.
