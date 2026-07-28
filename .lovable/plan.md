## Goal

Make the Reasoning engine the one brain: it owns the active line, collects everything written between Start Point and End Point, evaluates it, and Check / silent marking only display what it decided. The Reasoning panel becomes an accurate live debugger with no persistence of its own.

## Confirmed root cause of the wrong "Student Line (Live)"

Both the grader's row resolver (`PresentationView.tsx:3029-3050`) and the live broadcast builder (`PresentationView.tsx:3369-3389`) pick which board row belongs to a line by **best token overlap with that line's expected floating numbers** — not by the row the student is actually writing on. So while you write Line 3, the panel can show whichever row happens to overlap best (often Line 2's ink). The Reasoning panel additionally runs its **own** dry-run call to `grade-line` (`TeacherReasoningPanel.tsx:280-311`), independent of the student's session, which is the second source of desynchronisation.

## Architecture

```text
student action ─┐
floating display│
presenter preview├─► Reasoning Engine (single active line + session)
keyboard/symbols │         │
AI insertions   ─┘         ├─► live snapshot ──► Reasoning panel (debugger, no storage)
                           └─► evaluation at End Point ──► marks/progress
                                     ▲
                          Check button reads this result only
```

### 1. Reasoning engine module (new)
A single client-side engine holding: active line index + lineId, the session's board row, the live expression, the teacher's floating tokens for that line, student-introduced terms, and the last evaluation. Purely in memory — cleared on line change, question change and board scope change. Nothing written to the database from it.

### 2. Line → row binding (fixes Student Line (Live))
Replace overlap-guessing with an explicit binding: when a line becomes active (Start Point), the engine records the row the sensor is on and keeps that binding for the session. Student Line (Live) is always that row's ASCII, refreshed on every typing, floating drag, symbol insert, delete, preview click and floating-display move. Overlap matching is kept only as a fallback for lines never visited.

### 3. Start / End Point unification
- **Start Point:** floating display moves to a line, or a preview item on another line is clicked → new session, new row binding, reasoning cleared.
- **End Point:** leaving the line, **or pressing Check** → freeze expression, evaluate once, expose result, open next session.
- Floating display ↔ presenter preview stay bidirectionally synced through the single `activeLineIdx` (already unified) so all four surfaces always point at one line.

### 4. Attempt model (from your answers)
- Awarded marks are permanent: once a slot is solved, the engine never re-evaluates or reduces it, even if the line is edited later.
- Unawarded lines stay correctable: continuing on the same row = same attempt; starting the same line on a new row lower down creates a **new attempt** that becomes the active one, and the older attempt is marked invalid and can never be graded again.
- Only the active attempt is ever sent for evaluation.

### 5. Evaluation categories
Extend the server diagnosis so the panel and the Check toast show the agreed categories rather than generic text: add `number_not_given`, `symbol_not_supplied` (split from the existing floating-set verdict) and `cannot_evaluate_yet` (empty/dangling line), alongside the existing Correct/Equivalent/Incomplete line/Incorrect expression/Incorrect value/Missing term/Extra term/Wrong operation/Wrong sign rules. Every category keeps its 1–3 word label plus a one-sentence teacher-only detail, and never reveals the answer.

### 6. Check button and silent marking become viewers
`checkActiveLine` no longer resolves rows or grades on its own — it asks the engine to close the session and shows the returned result. Silent auto-marking records the same result. The Reasoning panel drops its independent dry-run call and renders the engine's broadcast instead, so student, teacher, Check and silent marking can never disagree.

### 7. Reasoning panel (debugger view)
Displays, all keyed off the same broadcast: Current question · Active line · Expected line · Student line (live) · Floating numbers for this line (dynamic, active line only) · Student-introduced terms (student atoms not in the teacher's floating set, e.g. a typed `2` or `+c`) · Evaluation category + detail · Awarded / line marks · attempt badge when a line has been restarted. All of it is discarded when the line, question or board session changes.

## Technical notes

- New: `src/lib/smartboard/reasoningEngine.ts` (session, row binding, attempts, introduced-term diffing) plus tests.
- Edited: `PresentationView.tsx` (row binding, Start/End Point, Check → engine, snapshot from engine), `TeacherReasoningPanel.tsx` (render-only + new sections), `PresenterPreviewPanel.tsx` (already emits `onActivateLine`; ensure it also syncs the floating display), `supabase/functions/_shared/lineDiagnosis.ts` and `grade-line/index.ts` (new categories).
- `grade-line` stays the mathematical equivalence service the engine calls; it is no longer called by anyone else.
- No database schema changes; no reasoning data persisted.
