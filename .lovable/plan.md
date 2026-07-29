## First thing: it isn't the sync — it's the access gate

Verified against the live database for class SS2:

- `class_smartboard_state` **does** have the row: `notebook_id = 08698b90…` (the note you have open), updated `00:07`, and an active student is set. So the teacher board is broadcasting correctly.
- `classes.smartboard_visibility = 'teacher_only'`.

The student page shows the board only when **both** are true: visibility is `student_access_enabled` **and** a notebook is set (`StudentSmartBoardPage.tsx` line 117). Visibility is off, so students get "Your teacher hasn't opened the SmartBoard yet."

Why it silently regressed: the only place that flips that toggle is the class SmartBoard launcher page (`ClassSmartBoardLauncher.tsx`). If a teacher opens the board directly at `/smartboard/:id?classId=…` (or the toggle was ever switched back), students stay locked out with no indication on the teacher's board.

## What to change

1. **Show the state where the teacher actually is.** Add a live "Student Access" pill to the class SmartBoard header in `PresentationView` (only when `classId` is present, role teacher): reads `classes.smartboard_visibility`, shows `Students can see this board` / `Teacher only`, and toggles on click — same update the launcher already performs.

2. **Open = share, by default.** In `SmartBoardPage.tsx`, when a teacher opens a board with `?classId=…`, set `smartboard_visibility` to `student_access_enabled` alongside the existing `class_smartboard_state` upsert, so launching a class board always reaches students. The teacher can still switch it back with the pill from step 1.

3. **Close = stop sharing (optional but recommended).** When the teacher leaves the class board, leave the state row intact but keep visibility as-is — no auto-revert, so a reload never kicks students out mid-lesson.

## Technical notes

- Files: `src/pages/SmartBoardPage.tsx`, `src/components/smartboard/PresentationView.tsx` (header area), reusing the existing update in `src/pages/class/ClassSmartBoardLauncher.tsx`.
- No database migration needed — realtime on `classes` and `class_smartboard_state` is already in the publication with full replica identity, and `StudentSmartBoardPage` already listens to `classes` UPDATE, so the student page unlocks instantly when the pill is toggled.
- No changes to sync payloads, board state, or student editing rights.

## Verification

Toggle the pill on the teacher board and confirm the student tab flips from the placeholder to the live mirror without a refresh; toggle back and confirm it returns to the placeholder.
