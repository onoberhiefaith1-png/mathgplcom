# Fix student assignment live viewing (two teacher modes)

Repair the existing assignment pipeline so a teacher always lands on the exact question the student is working on, and add the two viewing modes. No redesign of the board, the grading engine, or the assessment data model.

## What is actually broken (verified in code)

- The teacher viewer has **one** mode only. With no `?q=` it "follows" the student by polling `assessment_question_board_state` every 3 seconds and taking the most recently updated row.
- That table only gets a row once the student's board state is **persisted** (debounced write). A question the student has just opened but not yet written to has no row at all, so the teacher stays parked on the previous question — or on question 1 for a fresh student. This is the multi-question failure.
- The live board mirror channel in `useAssessmentBoardSession` is named per question (`assessment-board-<assessment>-<student>-<question>`). While the teacher's followed question is stale, the two sides sit on different channels and nothing mirrors live.
- Meanwhile the student's Smartboard already broadcasts a snapshot every ~120 ms on a question-agnostic channel `assessment-live-<assessment>-<student>`, and that payload **contains `questionId`**. The viewer page ignores it. This is the correct, instant follow signal and it is already in the app.
- Grading itself is fine: `TeacherEvaluationPanel` listens to that same channel for `board` and `check` events and refreshes `assessment_progress` on each check. Its `questionId` prop is only used for the durable fallback read, so it inherits the wrong-question bug but has no separate defect.

## What will change

### 1. Two explicit modes in the teacher viewer

A mode switch in the bottom control bar:

- **Join Student Live** — teacher's board tracks the student in real time and switches question automatically the moment the student switches. Shows a live/offline indicator.
- **View Student Work** — teacher picks any question from a question strip and reads the saved work for that question. No auto-following, no jumping while reviewing.

Default: Live when the student is currently on the board, otherwise View Work. An explicit `?q=` in the URL keeps opening in View Work on that question (existing links keep working).

### 2. Replace the DB poll with the live question signal

In Live mode the followed question comes from the student's `assessment-live-*` broadcast (`questionId`), applied immediately. The existing `assessment_question_board_state` query is kept only as a slow fallback for when the student is offline, so a teacher opening a closed session still lands on the last question worked on. Presence on the assignment presence channel drives the live/offline indicator.

### 3. Keep grading live in both modes

The Evaluation panel stays mounted and keeps its own subscription untouched; it receives the followed question id so its durable fallback reads the right row. Live grading status continues to arrive on every check event.

### 4. Entry points

`AssessmentStatusPanel` gets a second action next to "View Student Work": **Join Live**, enabled for students currently on the board. It opens the same viewer in Live mode. Used from both the assignment dashboard and the adventure dashboard.

## Technical notes

- `src/pages/class/TeacherAssessmentViewerPage.tsx` — mode state (`live` | `work`), a small subscriber to `assessment-live-<assessmentId>-<studentId>` reading `payload.questionId`, presence read for online state, question strip for View Work, DB query demoted to fallback. `buildBoardScope` stays in the `key`, so a question change still remounts the board cleanly — now only when the student genuinely changed question.
- `src/components/dashboards/AssessmentStatusPanel.tsx` — extra `onJoinLive` action plus online dot; callers in `AssignmentDashboardPage.tsx` and `AdventureDashboardPage.tsx` pass it.
- `src/hooks/useAssessmentBoardSession.ts` — unchanged contract; it simply receives the correct `questionId` now.
- Tests: a unit test covering "broadcast question id wins over the polled row" and "View Work mode ignores the live question", alongside the existing board-sync tests.
