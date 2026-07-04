# Make the Smartboard + Presenter Preview smooth and reliable

## What is actually wrong (found via console logs + session replay)

1. **Infinite render loop** — the board is stuck in a "Maximum update depth exceeded" loop (`SmartLineLayer` ← `occupancyTick` ← repeated `freeLines`/`smartLines` state updates). While this loop runs, the app eats all its own CPU: Next clicks get dropped, notes randomly fail to appear, and behavior changes after every refresh. This is the "work / no work" stiffness.
2. **Heavy work on every change** — the undo-history effect runs `JSON.stringify` on the entire board state after every keystroke/write, and localStorage is written synchronously on every change. This compounds the lag.
3. **Live-sync echo risk** — the broadcast/apply-remote effects can ping-pong state (apply remote → broadcast → apply again), feeding the loop.
4. **Edit mode exits to a blank board** — leaving Edit clears the board completely instead of restoring what playback had already presented, so Next appears "stuck on the first page" afterwards.
5. **Edit only mirrors the clicked item** — it does not check that earlier lines (their floating numbers and notes) are on the board, which is the whole purpose you described.

## Plan

### Step 1 — Kill the render loop (root fix for stiffness)
- Trace and break the `freeLines`/`smartLines` update cycle in `PresentationView.tsx`:
  - Guard the occupancy-tick effect so it only bumps when content actually changed.
  - Guard the live-sync pair (apply-remote / broadcast) so applying a remote snapshot can never immediately re-broadcast it, and identical snapshots are never re-applied.
  - Stabilize the loop trigger in `SmartLineLayer` (remove the redundant internal tick state; occupancy is already re-evaluated by the prop change itself).
- Verify with Playwright that the console stays clean (zero "Maximum update depth" warnings) while presenting.

### Step 2 — Remove the heavy per-keystroke work
- Replace the full-board `JSON.stringify` comparison in the undo-history effect with cheap reference checks.
- Debounce localStorage persistence (board ink, smart lines, sensor) to ~300ms instead of every change.

### Step 3 — Fix Next after Edit
- When leaving Edit mode, do NOT blank the board. Instead restore the board to the current playback position (re-present everything up to the current beat/line from the Presenter Preview data), so Next continues exactly where the teacher was.

### Step 4 — Edit = "force it to show", including earlier lines
- When the teacher clicks an item in Edit mode (e.g. Line 5), the mirror will:
  1. Walk every earlier line in that section (Line 1…4) and verify each one's content is on the board.
  2. For any missing line: first write its **floating numbers exactly as they are** (no solving), then write its **note**, using the existing direct-write + 4-step rectify ladder until it verifies.
  3. Then present the clicked line itself the same way.
- Because the source is always the Presenter Preview's own data (one-to-one), once an item verifies ✓ it is on the board for good — playback can count on it.

### Step 5 — End-to-end smoothness test
- Use Playwright against the live preview: open a lesson, press Next repeatedly (must advance every time), open Edit, click a later line (earlier missing notes/floating numbers must appear), exit Edit, press Next again (must continue, not reset), refresh the page and repeat. Confirm zero console errors throughout.

## Technical details
- Files touched: `src/components/smartboard/PresentationView.tsx`, `src/components/smartboard/SmartLineLayer.tsx`, `src/components/smartboard/AiEditWorkspace.tsx`, `src/lib/smartboard/manualEdit/mirror.ts`, `src/lib/smartboard/manualEdit/autofix.ts`.
- No backend or data changes — this is all presentation/state-management code.
