## Goal

Three refinements to the existing student Smartboard flow. No architecture or UI redesign.

---

## 1. One Smartboard per question

**What I verified**

- `useAssessmentBoardSession` already supports a per-question mode: when a `questionId` is passed it reads/writes `assessment_question_board_state` (unique on assessment+student+question); otherwise it falls back to the single shared row in `assessment_board_state`.
- Only the Adventure path passes a question: `GamePlayPage` navigates to `.../assessment/:id?q=<questionId>`.
- The Assignment path (`StudentAssignmentPage`) links to `.../assessment/:id?source=assignment` with **no `q`**, so `AssessmentBoardPage` runs the board in shared mode and every question in that assessment writes into the same board row — this is the reported bleed.

**Fix**

- In `AssessmentBoardPage`, never run the board in shared mode: when the `q` param is absent, resolve an active question id from the assessment's question list (first question, or the last one the student worked on) and drive the board with it. Keep `q` in the URL so refresh/back restores the same question.
- Scope the board source to the active question only (the existing filter already does this) and keep the remount `key` tied to the question id so switching questions loads a clean board and then hydrates that question's saved state.
- Add question navigation on the assignment path consistent with the current UI: `StudentAssignmentPage` links each question with `?q=<questionId>`, so each question opens its own board.
- Teacher viewer (`TeacherAssessmentViewerPage`) already follows the student's question id — verify it always joins the same per-question channel/row as the student, including when the student switches questions mid-session.
- Legacy work already saved in `assessment_board_state` stays readable: on first open of a question with no per-question row, fall back to the legacy row once, then save it under the question.

## 2. Smoother teacher–student live collaboration

Current path: 90 ms debounced broadcast + 700 ms debounced DB write, plus a 250 ms safety re-publish loop.

- Cut the broadcast debounce to a single animation-frame-style flush (~30–50 ms) and send in-place mutations (drag, delete, rearrange, floating numbers) on the same fast path; leave the DB write debounced for durability only.
- Make the teacher side a full co-author in Assist mode on the identical channel name (assessment + student + question) so both directions stream; View Mode stays read-only receive.
- Harden the channel: keep the existing retry, and add a re-subscribe on browser reconnect/visibility so neither side needs a refresh after a network blip; on reconnect, immediately re-publish the full board so the late side catches up in one frame.
- Keep the author-echo guard so a side never re-applies its own snapshot (prevents cursor jumps).

## 3. Timer synchronization (teacher = master)

**What I verified**

- `game_time_bars` is in the realtime publication and has a `SELECT` policy for class owners **and** class members, so students are allowed to read teacher timer changes.
- Students already consume `useGameTimeBar`, which subscribes to `postgres_changes` on that table. The subscription is created with no status handler and no retry, unlike the other realtime hooks in the app, so a failed/dropped join leaves the student silently stuck on the row fetched at load. This is the most likely cause but is unconfirmed — step one is to confirm it live before changing behaviour.

**Fix**

- Confirm the failure with a live check (student page open, teacher presses ±1 min / pause) and read the channel status.
- Then in `useGameTimeBar`: add subscribe-status handling with bounded retry and re-subscribe on reconnect/tab-focus, plus a low-frequency refetch fallback (a few seconds) so the student converges even if realtime is down.
- Keep all timer math derived from the shared row (`started_at`, `paused_at`, `accumulated_paused_ms`, `duration_seconds`) so remaining/elapsed/state are identical on both sides. Students remain read-only; only teacher controls write.

## Technical notes

- Files: `src/pages/student/AssessmentBoardPage.tsx`, `src/pages/student/StudentAssignmentPage.tsx`, `src/hooks/useAssessmentBoardSession.ts`, `src/components/smartboard/PresentationView.tsx`, `src/pages/class/TeacherAssessmentViewerPage.tsx`, `src/hooks/useGameTimeBar.ts`.
- No schema changes required — `assessment_question_board_state` already exists with the right unique key.
- No UI/layout changes beyond passing the question id on assignment question links.

## Verification

- Assignment with 2+ questions: solve Q1, open Q2 → clean board; return to Q1 → Q1's work restored.
- Teacher Assist mode: strokes, drags and deletes appear both ways with no refresh.
- Teacher timer start/pause/resume/reset/±1 min → student's timer mirrors immediately.
