# Academia: open questions directly (no guest links) + back buttons

## What changes for users
- Each Academia card = one question. Clicking it opens the Practice / Play page (unchanged). Practice and Play now open the question **directly inside Academia**, the same as a student opening an assignment in their class. No guest link, no "What should we call you?" page, no "Solve" list page.
- The student works straight on the Floating Numbers board (Practice) or straight in the Game (Play), signed in as themselves. Marks are saved to their Academia record (best score counts, status updates).
- Schools and teachers who open a card get the same direct experience.
- Every Academia page gets a clear top bar with a **Back** button and a breadcrumb: Academia home → Session → Practice/Play page → board/game. Back always returns one level up (never to a guest page).

## Steps
1. **Store the real question, not a link.** When a question is assigned to Academia, save the question's own id (and the Game id when attached) on the card. Stop creating guest links for Academia.
2. **Direct Practice page** `/academia/activity/<id>/practice`: opens the same student board used for class assignments, with that single question, timer on, brown/blue colours as agreed. Saves the attempt to Academia.
3. **Direct Play page** `/academia/activity/<id>/play`: opens the Game with this question as its Level, signed-in play, result saved to Academia.
4. **Access rule:** anyone allowed to view that Academia (school, its teachers, enrolled/own-school students, public viewers) may open and answer these questions; school reports stay per school.
5. **Records:** Practice/Play marks feed `academia_attempts` directly (no more reading guest marks). Remove the double attempt count from the session card click.
6. **Navigation bar:** one shared Academia top bar (Back + breadcrumb + title) on Academia home, Session, Practice/Play choice, Practice board and Play pages, for students, teachers and schools.
7. **Existing cards:** cards already assigned with guest links are converted to the direct form automatically (their question is found from the saved link); if one can't be matched it shows "Assign again".
8. Browser-check as a student: card → Practice opens the board immediately; card → Play opens the Game immediately; Back works on each page.

## Technical details
- Add `assessment_id uuid` and `game_id uuid` to `academia_activities`; `assignToAcademia` writes them (keeps `assignAssessmentQuestion` + `assignQuestion` into the hidden class) and no longer calls `ensureGuestLink`.
- Questions live in the teacher's hidden test class, which students can't read under current rules. Add security-definer functions `academia_open_activity(activity_id)` (returns the assessment payload if `can view` the activity's Academia) and `academia_submit_attempt(activity_id, mode, score, max)` (upserts best score/status in `academia_attempts`). Execute granted to `authenticated` only, with the view check inside.
- Practice route renders `AssessmentBoardPage`'s board component in an `academia` mode (payload from the function, grading via existing grade-line, results sent to `academia_submit_attempt` instead of class progress). Play route renders `GamePlayPage` in an `academia` mode analogous to its existing `guest` prop but authenticated.
- `syncAttempts` guest-mark fetch removed. Backfill migration maps existing `link_code`/`game_link_code` via `guest_links` to `assessment_id`/`game_id`.
- New `AcademiaTopBar` component used by `StudentAcademiaView`, `SchoolAcademiaPage`, `TeacherAcademiaPage`, `AcademiaSessionPage`, `AcademiaActivityPage` and the two new routes.
