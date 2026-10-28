# Live Classroom SmartBoard — one shared workspace

Scope: only the board a class opens together (teacher `/smartboard/:id?classId=…`, student class board). The Lesson Note test board, assessment boards, guest/card boards and every other board stay exactly as they are — every change below is gated on the classroom sync being active.

## What is wrong today (confirmed in the code)

**A. Delivery depends on the teacher doing something after a student joins.**
- Live frames travel over a broadcast channel, but a joining student is only sent the current board if the teacher's page already holds a local snapshot in memory. That memory is filled only when the teacher edits, so a student who joins a board that is sitting still can stay blank until the teacher types — or until the student reloads.
- The durable copy of the board is written on a delay after teacher edits. If the teacher hasn't edited since opening, there is nothing to load, which is exactly the "PC blank until refresh" symptom.
- Frames are sometimes sent before the channel has finished joining. The live log shows the transport reporting it fell back to a plain request for one of these sends, so that update is effectively lost.
- The duplicate-frame guard throws away every later frame from a sender whose counter restarted (teacher reopened the board), so a student can silently stop receiving updates with no visible error.
- A 20-second background reload is still in the path, which is why updates sometimes arrive in a clump after a pause.

**B. Floating Numbers are not part of the shared board at all.**
- The shared board carries only "which line is active" as a plain position number. The floating-number panel keeps its own private state: which chips have been taken, in what order, and how the row is laid out, all identified by their position in an array.
- The chip set itself is rebuilt independently on each device from the lesson content, and the log shows the classroom board falling back to deriving chips from equations when curated data is missing. Teacher and student can therefore build different arrangements from the start.
- Because chips and lines are identified by position rather than identity, an action meant for one line lands on whichever line now sits at that position — this is the "revealing one line revealed several" and "numbers merged/scattered" report.

## The fix

### 1. One workspace, always available
- The teacher's board publishes a full snapshot as soon as it opens and whenever a student joins, not only after an edit.
- A joining client asks for the current board and, in parallel, reads the durable copy; whichever arrives first is shown, and later live frames always win. No gap where updates can be missed.
- The durable copy is written once immediately when the board opens so a late joiner always has something to load.

### 2. Send only after the connection is live, and never lose a frame
- Outgoing changes queue until the channel reports it has joined, then drain in order. Nothing is sent down a half-open connection.
- On reconnect the client re-announces itself and takes a fresh full snapshot, then resumes small changes.
- The ordering guard is rewritten so a restarted counter is adopted instead of blocking everything after it.
- The teacher keeps rendering locally the instant they act; publishing happens alongside it. Small per-field changes stay as they are (they are already tiny); the background reload timer is removed from the classroom board so the live channel is the only delivery path.

### 3. Floating Numbers become shared board state with real identity
- Give every floating chip and every floating line a stable id generated once with the lesson content, and share the built arrangement itself as part of the board rather than rebuilding it per device. The student renders the teacher's arrangement; it is never re-derived or re-shuffled locally.
- Move the panel's "taken / used / revealed" state out of local component memory into the shared board, keyed by line id + chip id.
- Every floating operation (take, return, move, reveal, hide, change line) is published as a change to that specific chip id on that specific line id. A line's state can no longer touch another line.
- Keep the existing panel component and its behaviour; only its source of truth changes, and only when the classroom board is active. Other boards keep their current local behaviour.

### 4. Classroom isolation
- Channel, durable row, and every shared id are scoped by class id; nothing global. Verified by opening two classes side by side.

### 5. Developer diagnostics (hidden)
- A debug-only panel on the classroom board showing: connection state, class and board id, last sent/received change with timestamp, sequence number, queued changes, connected clients, and any sync error. Off for normal teachers and students.

## Technical notes

- `src/hooks/useSmartboardSync.ts`: join-gated send queue, immediate full-snapshot publish on open and on peer join, coordinated hydrate (row + snapshot request) with live-wins precedence, corrected per-sender sequence handling, reconnect resync, removal of the safety poll, diagnostics surface.
- `src/components/smartboard/PresentationView.tsx`: extend the shared board state with an identified floating-number model (`floatingLines: {lineId, chips:[{chipId,…}]}` plus `floatingState` keyed by `lineId:chipId`), publish floating operations, and apply remote floating operations by id. All new branches read `syncEnabled` so non-classroom boards are untouched.
- `src/components/smartboard/FloatingNumberPanel.tsx`: accept id-based slots and controlled used/revealed state via optional props; falls back to its present internal behaviour when those props are absent (all other boards).
- `src/lib/smartboard/presentation.ts`: attach stable line/chip ids when the arrangement is built, including the equation-derived fallback path.
- Tests: sequence/reconnect/queue behaviour, hydrate-vs-live precedence, per-line isolation of reveal, and arrangement fidelity between publisher and receiver.

## Verification

Signed-in, two browser contexts against the same class (teacher + student) plus a phone-sized context: student joins an idle board and sees content with no refresh; continuous typing arrives continuously; connection dropped and restored recovers without refresh; multiple floating lines keep their exact arrangement and revealing line 1 leaves line 2 untouched; a second class receives nothing from the first.
