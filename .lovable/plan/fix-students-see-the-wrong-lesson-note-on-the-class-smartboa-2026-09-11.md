# Fix: students see the wrong lesson note on the class SmartBoard

## What is actually happening (confirmed)

For the class you are testing:

- The note the teacher is presenting is **"linear equation"**, and the class note list was correctly updated at 09:55:36.
- The class board record still points at an **older notebook that no longer exists** (it was the deleted quadratic note). Its "which note is live" field was never updated.

Cause: when the teacher opens a different note on the class SmartBoard, the code tries to clear the saved board drawing by writing an empty value into a field that is not allowed to be empty. The whole save is rejected, so the "which note is live" field silently keeps the previous note. The teacher's own screen looks right because it uses the note from the address bar; the student screen reads the stored field, so it stays on the first note — and after the old note was deleted it shows "Notebook not found".

## The fix

1. **Always record the note the teacher opened.** Split the write into two safe steps: first set the live note (never writing an empty saved-drawing value), then reset the saved drawing separately using an allowed empty value when the note changed. Surface a visible error to the teacher if it ever fails instead of only logging it.
2. **Verify after writing.** Immediately read the record back; if it does not match the note being presented, retry once and show a clear message if it still fails.
3. **Student side follows the teacher, always.** The student board keeps listening for changes as now, and additionally:
   - If the stored note no longer exists (deleted), show "Your teacher's lesson note is no longer available — waiting for the next one" instead of the raw "Notebook not found" screen, and pick it up automatically as soon as the teacher opens another note.
   - When the live note changes, the student board rebuilds cleanly for the new note (no leftover state from the previous note).
4. **Clean up deleted notes.** When a note is removed from the system, any class that had it live is cleared, so no class points at a missing note. Applied to existing records too, so your current class stops pointing at the deleted quadratic note.
5. **Teacher clarity.** On the class SmartBoard picker, mark the note that is currently live to the class, so with 20 notes the teacher can always see which one students are watching.

## Technical notes

- `src/pages/SmartBoardPage.tsx` — `openClassSmartBoard`: remove `state_json: null` from the upsert (column is `NOT NULL`); use `state_json: {}` in a separate update when the notebook changed; add read-back verification and a toast on failure.
- `src/pages/student/StudentSmartBoardPage.tsx` — handle "notebook missing" as a waiting state; key `PresentationView` on the active notebook id so it remounts on switch.
- `src/components/smartboard/PresentationView.tsx` — student-facing missing-notebook branch when rendered inside the class board (no "Back to shelf" dead end).
- Migration: `ON DELETE SET NULL`-style cleanup for `class_smartboard_state.notebook_id` (trigger or FK) plus a one-off update clearing rows whose notebook no longer exists.
- `src/pages/class/ClassSmartBoardLauncher.tsx` — "Live now" badge from `class_smartboard_state.notebook_id`.
- Tests: a unit test for the state-write payload (never null `state_json`) and a regression test that a notebook switch updates the live note.
