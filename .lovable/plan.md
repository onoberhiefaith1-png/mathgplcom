## Goal

One active line shared by Floating Number Display, Presenter Preview, Student SmartBoard, Teacher Reasoning, Check and Silent Marking — plus a clearly defined Start Point / End Point editing session that bounds what Check evaluates.

## What the code actually does today (verified)

All of this lives in `src/components/smartboard/PresentationView.tsx`:

- `activeLineIdx` (~line 2188) — the grading cursor. Check Line (`checkActiveLine`, ~3117) and silent marking (~3133, ~3149) both use it, and it is the value broadcast to the Reasoning panel (~3192). That is why Reasoning already "follows the right line".
- `floatingLineIdx` / `manualFloatingLineIdx` (~2189) — drive the chip strip through `curLineIdx` (~4812) passed into `FloatingNumberPanel`.
- `displayedGuidedIdx` (~2359) — a sensor/row-ownership derived index, used as `activePreviewLineIdx` for the Presenter Preview highlight (~4065). A comment at ~4060 documents that this deliberately diverges from the floating index.

So there are three parallel cursors, hand-synced at several call sites (~3079, ~4864, ~4895, ~4932). Drift between them is the inconsistency being seen.

Two more confirmed gaps:
- Clicking an item in `PresenterPreviewPanel.tsx` (`selectTarget`, ~229) only sets a local mirror/AI-edit selection. It does **not** move any line cursor, so a Preview click never pulls the Floating strip or grading cursor to that line.
- Check has no session boundary: `resolveGradableLine` (~2975) re-scans the board rows and grades whatever is currently written, so content typed after a line was left can still influence its result.

No new ID system is needed — line index + `lineId` from `guidedLines` already exist.

## Plan

### 1. Single active-line state
Replace `activeLineIdx`, `floatingLineIdx` and `manualFloatingLineIdx` with one state (`activeLine`) plus one setter `setActiveLine(idx, source)`. `displayedGuidedIdx` becomes a pure fallback used only when no line has been explicitly activated, never a competing source of truth. Collapse every lockstep triple-setter call site to the single setter.

Consumers after the change:
- `FloatingNumberPanel` ← `activeLine`
- `activePreviewLineIdx` ← `activeLine`
- grading / silent marking ← `activeLine`
- live broadcast `activeLineIdx` ← `activeLine` (Reasoning keeps working unchanged)

### 2. Presenter Preview drives the active line
In `PresenterPreviewPanel`, clicking/dragging an item from line *k* calls a new `onActivateLine(k)` alongside its existing selection behaviour. `PresentationView` maps that to `setActiveLine(k, "preview")`. The mirror/AI-edit selection is left as is. Result: Preview click → Floating strip, board, Reasoning and Check all move to that line.

Conversely the chip strip's Prev/Next/jump handlers already funnel into the same setter, so the Floating panel drives Preview too.

### 3. Editing session (Start Point / End Point)
Introduce a session record held in a ref:

```text
session = { lineIdx, lineId, startedAt, entries[] }
```

- **Start Point** — created whenever `setActiveLine` changes the index (from either panel).
- During the session every input is appended to `entries`: floating chip taps, Preview insertions, keyboard/symbol input, AI insertions. Source does not matter.
- **End Point** — the moment `setActiveLine` moves away: freeze the collected expression, grade it, persist the score, then open the new session.

### 4. Check + Silent Marking read the frozen session
`gradeLineThroughEngine` stops re-scanning the whole board. It takes the frozen session expression for the line being graded and compares it only against that line's expected key. Manual Check grades the *current* live session; silent marking grades the *just-closed* session. Anything written after the End Point belongs to the next session and cannot change an already-recorded result — matching the "teacher marking exercise books" rule in Examples 1–4.

The idle-timeout auto-check stays, but evaluates the live session rather than the board.

### 5. Tests
Add a test file covering: one active line across all consumers; Preview click moves the Floating index and vice-versa; Example 2 (post-End-Point `3x` ignored); Example 3 (`+ c`, `= 0` typed in-session count); Example 4 (duplicate `+ c` in-session marks Incorrect).

## Technical notes

- Change is contained to `PresentationView.tsx`, `PresenterPreviewPanel.tsx`, `FloatingNumberPanel.tsx` (props only) and a new session helper module under `src/lib/smartboard/`.
- No database migration and no edge-function contract change — `grade-line` still receives `{ questionId, lineId, studentAscii, allowedFloatingTokens }`; only the way `studentAscii` is assembled changes.
- `TeacherReasoningPanel.tsx` needs no change; it keeps consuming the broadcast `activeLineIdx`.
