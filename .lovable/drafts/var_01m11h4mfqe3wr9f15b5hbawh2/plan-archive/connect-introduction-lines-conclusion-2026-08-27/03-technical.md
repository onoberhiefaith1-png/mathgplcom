## Technical changes

**`PresentationView.tsx` — report engagement, not just position.**
The reported line context gains one field: `lineEngaged`. It is false on open and flips to true permanently the first time the student really activates a line (Floating Numbers / # placement, a Present-list selection, Next, Previous, or the first graded input on the active line). The line cursor itself, the grading, and `lastAwardedLineId` stay exactly as they are.

**`QuestionVideoPane.tsx` — orchestration only.**
- Introduction effect: play `intro` on mount when enabled; do not mark it "done" from a render.
- Line effect: ignore the reported line while `lineEngaged` is false, so the Introduction is never cut off by the default cursor. Once engaged, every change of `lineId` pauses the current clip, seeks to that line's `start`, and plays (an already-awarded line seeks without auto-replay, as today).
- Keep stop-at-section-end as the only stopping rule, and keep the "no auto-advance to the next line" behaviour — a finished segment just waits.
- Conclusion effect stays keyed to `lastAwardedLineId === final line`, plus a guard so a line activation arriving after the mark cannot cut the Conclusion short; it plays to the end of the file.
- When intro or conclusion is disabled, or no video is attached, nothing new happens.

**Teacher test board (`TeacherExerciseQuestionsPage.tsx`) and student board (`AssessmentBoardPage.tsx`)** just pass the extra field through; the per-question reset already clears intro/conclusion state.

**Verification:** unit tests for the orchestration rules (intro holds until engagement; skip Line 2 → Line 5; conclusion only on the awarded final mark), then a live run through the exercise board.
