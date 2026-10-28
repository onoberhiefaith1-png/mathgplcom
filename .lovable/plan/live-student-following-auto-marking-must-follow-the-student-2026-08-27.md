# Live student following + auto-marking must follow the student

Right now, when you open a student live the board lands on Question 3 while the student is writing on Question 1, the Evaluation panel reads that same wrong question, and the first line the student writes is not being marked. The three buttons at the top of the board (Join Student Live / View Student Work / Offline) also duplicate what the dashboard already offers.

## 1. Live view follows the student, never "the last question touched"

Today, when the teacher's board has not yet received a live frame from the student, it silently falls back to the most recently *saved* question row — which is the last question that got written to the database (Q3), not the one the student is on now. The Evaluation panel does the same fallback independently.

Changes:
- In live mode the question is decided only by the student: the live board broadcast, or — before the first frame arrives — an instant "current question" pointer the student's board publishes the moment a question opens (carried in the presence record, so it is available the instant the teacher joins).
- Remove the "latest saved row" guess from live mode entirely. If no student signal is available yet, the board shows a short "waiting for the student's board…" state instead of a wrong question.
- The Evaluation panel uses the same resolved question as the board, and clears its line/verdict state whenever the student changes question, so it can never display Q3's last line while the student is on Q1's first line.
- Saved-row fallback stays where it belongs: View Student Work (offline review).

Note: whether the live frames are arriving at all in your session is not yet confirmed. The first implementation step is to verify the student→teacher live channel end to end (student publishes, teacher receives) and fix the transport if frames are being dropped, before the follow logic is tuned.

## 2. Marking belongs to the student's board, visible only to the teacher

The auto-marker already lives on the student's board (correct place). Two gaps make it look dead:
- The continuous live evaluation runs in non-persisting mode, so its verdicts are informational only.
- The persisting auto-mark only fires when the student *leaves* a line, or after an idle pause on the active line — so a first line written and then kept open often stays unmarked.

Changes:
- Grade and record the active line as soon as its content settles (short debounce), not only on leaving it, so line 1 is marked while the student is still on it. Already-earned lines are never re-marked or double-scored.
- Every recorded verdict is broadcast on the student's live channel, so the teacher's Evaluation panel shows the real marks as they are earned.
- The student still sees no evaluation bar and no verdicts — nothing about the student-facing board changes.

## 3. Remove the three buttons from the top of the board

Delete the floating Join Student Live / View Student Work / Offline control from the teacher viewer board. The mode is decided by which action the teacher clicked on the dashboard (Join Live vs View Student Work) and carried in the link; the online/offline dot stays on the dashboard where it already exists. The question strip for review mode stays, since that is how the teacher picks a question when reading saved work.

## Technical notes

- `src/lib/assessments/viewerFollow.ts` — live mode resolves to broadcast question → presence-reported question → null (no persisted fallback); work mode unchanged.
- `src/pages/class/TeacherAssessmentViewerPage.tsx` — read `questionId` from presence metadata, drop the top control cluster, render a waiting state when live has no question yet.
- `src/pages/student/AssessmentBoardPage.tsx` — include the open `questionId` in the presence `track()` payload and re-track on question change.
- `src/components/smartboard/PresentationView.tsx` — active-line grading debounce persists (`persist: true`) and broadcasts the verdict; guards for solved slots and timer confirmation kept as they are.
- `src/components/smartboard/TeacherEvaluationPanel.tsx` — accept the resolved question as authoritative, ignore the saved fallback while live, reset `lastCheck`/feed on question change.
- Tests extended in `src/lib/assessments/__tests__/viewerFollow.test.ts` for the no-stale-fallback rule plus a new test for the presence-question source.
