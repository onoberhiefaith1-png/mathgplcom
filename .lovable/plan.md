## Goal

Attempts must track *writing*, not *navigation*. Today `ReasoningEngine.start()` is called from a `useEffect` that fires whenever `activeLineIdx` changes, so simply moving the Floating Number Display bumps the attempt count and opens/freezes sessions for lines the student never touched.

## Current behaviour (verified)

- `src/components/smartboard/PresentationView.tsx` (~line 3294): on every `activeLineIdx` change it freezes the previous line and immediately calls `reasoningRef.current.start(...)` + `startSession(...)` for the newly displayed line — navigation alone creates an attempt.
- `src/lib/smartboard/reasoningEngine.ts`: `start()` invalidates prior attempts and increments `attempt` whenever the row binding differs. There is no concept of "attempt not yet begun" and no way to cancel an emptied attempt.
- `src/lib/smartboard/editingSession.ts`: sessions are created eagerly and can only be frozen, never discarded.
- Locking already works via row ownership (`rowOwners` / `displayedLineRows`, ~line 2426): rows owned by the displayed line stay editable, all others lock. Returning the display to line N re-opens its rows. This part is kept as-is.

## Changes

### 1. `src/lib/smartboard/reasoningEngine.ts` — pending vs. real attempts

- Add `enter(lineIdx, lineId, rowNum)`: records a *pending* (navigation-only) visit. Does not create an attempt, does not invalidate anything, does not change `attemptFor`.
- Add `write(lineIdx)`: promotes the pending visit into a real attempt (increments count, invalidates prior attempts on the same line). Idempotent while the attempt stays alive.
- Add `cancel(lineIdx)`: removes the current attempt for that line entirely — no history, no freeze, no snapshot — and restores `attemptFor` to the previous value.
- Add `lastUnfinishedLine()`: the most recent attempt that was started, not cancelled, and has no awarded marks — used to auto-return the student.
- `end()` becomes a no-op when there is no real attempt (nothing was written).
- Keep `start()` as a thin wrapper over `enter` + `write` so existing tests/callers stay valid.

### 2. `src/lib/smartboard/editingSession.ts` — cancellable sessions

- Add `hasContent(session)` and `cancelSession(session)`; a session with zero entries and empty ascii is discarded rather than frozen.

### 3. `src/components/smartboard/PresentationView.tsx` — wire the state machine

- Split the current `activeLineIdx` effect:
  - **Navigate:** freeze/auto-check the line being left *only if it has a real attempt with content*; then call `engine.enter(...)` for the new line. No `startSession` yet.
  - **First write:** in the single place where board ink for the active line changes (the existing `freeLines` / `resolveGradableLine` observation used by auto-check), when the active line's ascii goes from empty → non-empty, call `engine.write(...)` and `startSession(...)`.
  - **Empty again:** when the active line's ascii goes non-empty → empty, call `engine.cancel(...)`, discard the session, drop `frozenByLineRef[k]`, and if `engine.lastUnfinishedLine()` exists, `setActiveLineIdx` back to it (Rule 7/8 — this also restores its editable rows through the existing ownership logic).
- Awarded lines (Rule 9): cancellation and re-entry never touch `solvedSlots` / `assessScore`; the grader already skips already-solved slots, so awarded marks stay permanent while the maths may still be edited.

### 4. Tests

- Extend `src/test/reasoningEngine.test.ts`: navigation across 2→4→6→3 keeps attempt count; write increments; delete-all cancels and restores the prior count; cancelled attempt leaves no frozen value.
- New `src/test/attemptLifecycle.test.ts` covering Rule 7 (write on line 8, clear it, ownership returns to unfinished line 6) and Rule 9 (awarded marks survive a later edit).

## Not changed

Row locking/unlocking, the Floating Number Display, grading pipeline, persistence (reasoning stays in-memory; only marks are saved).
