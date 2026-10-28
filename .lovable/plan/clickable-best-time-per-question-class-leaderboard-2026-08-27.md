# Clickable Best Time → per-question class leaderboard

The timer stays exactly as it is. The only change: "Best" becomes clickable and opens a left-side ranking drawer for the current question.

## Behaviour

- The timer strip (current time, Best, Reset, zoom) keeps its position and styling. "Best" becomes a button with a hover/focus cue and a "Class ranking for this question" tooltip.
- Clicking opens a drawer from the left edge, over the board chrome, with the Smartboard still visible behind it. Header: "Class Leaderboard", the question label, and a clear × close button (Escape also closes).
- Ranked list = every class member with at least one successful timed attempt for this exact question, sorted by their fastest recorded time. Positions 1, 2, 3 …; exact ties share a position (existing ranking rule reused).
- Below the ranked block, every remaining class member appears with no position and "Not started". No invented times.
- The viewer's own row is highlighted so a student can see "I'm currently 5th".
- Opening/closing the drawer does not navigate, reset work, restart the timer, or change the question.
- Live updates: the drawer subscribes to timed-attempt changes for this assessment + question, so a new better time repositions that student immediately (and the same panel is what the teacher sees on the teacher board).
- Empty class / no data: "No recorded times yet."

## Data

Ranking source is the existing per-question attempt table — the best (lowest) elapsed time among that student's successful attempts, per assessment + question. Nothing is written by this feature; it reads only.

One backend change is required: today a student may only read their own timed attempts, so a class leaderboard would show only themselves. A migration adds a read-only policy letting members of the class that owns the assessment read timed attempts for that assessment. Teachers' existing read policy and the students' own-row write policy are unchanged; no column, no grant widening beyond select for class members.

Names come from the existing class roster helper, which already returns display names for class members.

## Technical notes

- New `src/lib/assessments/questionLeaderboard.ts`: `loadQuestionLeaderboard({ assessmentId, questionId, classId })` → `{ ranked: {userId, name, ms, place}[], notStarted: {userId, name}[] }`. Best time per student = `min(elapsed_ms)` where `success`. Reuses the tie rule from `rankByTime` in `AssignmentTimerPanel` (extract the pure helper into this lib and re-export so `timerRank.test.ts` keeps passing).
- New `src/components/smartboard/QuestionLeaderboardPanel.tsx`: fixed left drawer (`inset-y-0 left-0`, above board chrome, below modals), palette-token styling, × button, `useEscapeClose`, realtime `postgres_changes` subscription on `assessment_timer_attempts` filtered by `assessment_id`, refetching on any change.
- `src/components/smartboard/PresentationView.tsx`: wrap the existing `Best …` span in a `<button>` that toggles `leaderboardOpen`; render the panel when open, passing `assessmentId`, current `questionId`, `classId`, viewer id. No change to `useQuestionTimerAttempt`, marking, or zoom.
- Migration: add `select` policy on `public.assessment_timer_attempts` for authenticated class members via the existing `is_class_member`/class lookup on the parent assessment.
- Tests: pure ranking/partition tests (times ranked ascending, ties shared, non-starters excluded from numbering and listed last).

## Verification

Open a student question board with the timer on, click Best → drawer opens from the left with ranked times and "Not started" rows underneath, board untouched behind it. Close it, keep solving, beat the time → the row moves up without a refresh.
