# Academia, Assignment timer, line colours, Flow, Solution heading — fixes

Each item below is one fix, in the order you listed them.

## 1. Student Academia looks exactly like the School and Teacher Academia
- Replace the current student view with the same column layout the School and Teacher use: Classes -> Subjects -> Topics -> Subtopics -> Sessions.
- The student "enters" the school they added: they see that school's Academia arranged exactly as the school arranged it (read-only, no Add/Remove buttons).
- Clicking a Session opens the same Session page (video on the left, cards on the right).
- Explore / Add Academia stays as the way in; once added, the student opens it and sees the columns.
- School, teachers and students all use the same Session page.

## 2. One question card per assigned item, then a Practice / Play page
- On the Session page, an assigned lesson-note question appears as ONE card (not separate Practice and Play cards).
- Clicking the card opens a new page with two choices only: **Practice** (the assignment questions) and **Play** (the attached Game — shown only if a Game was attached).
- The Game is stored with the question card instead of as its own separate card.

## 3. "Link not available" when opening an Academia item
- First confirm the cause by opening an assigned Academia card in the browser and reading what the link page returns.
- Then make it open the same way Assignment and Adventure links do (same link type, enabled, correct class), and repair items already assigned.

## 4. Every assignment has a timer
- Remove the on/off timer switch from the Assignment timer panel; timer is always on.
- New assignments are saved with the timer on; existing assignments are switched on.
- Timer behaviour is unchanged (starts at first input, pauses on leave, stops at 100%, keeps Best Time).

## 5. Swap the line colours
- Brown = mark awarded (permanent). Blue = solving again in the current timed attempt.
- Colour-swap only: no change to scoring, Reset, or when a line is coloured. Applies to the Smartboard, student assignment board, guest board and teacher viewer.

## 6. Flow character: three appearance options
- New "Character" setting on Flow Setup, next to the Trail setting:
  - **Only on explanation** (today's behaviour, default) — hides when solving numbers are activated.
  - **Always** — stays visible during solving too.
  - **Never** — character hidden; the trail still works on its own.

## 7. Trail keeps its set length
- Today the trail's length is counted in points, so a big jump across the board draws one long line from start to finish. Change it so the trail is measured in real distance: it is never longer than the set length. Moving from 1 cm to 90 cm with a 2 cm trail shows only 88 -> 90.
- When the fade time passes, the trail fully disappears.

## 8. "Solution" heading spelled in full
- When Co-Pilot generates a lesson note, the Solution heading sometimes splits ("SOLU" above, "TION" below the working). Make sure the full word "Solution" is written as the heading before the working starts, and repair split headings when a note opens.
- First step: reproduce with a generated note to find where the word is being cut.

## Technical notes
- Student columns: reuse `Column` from `SchoolAcademiaPage`, read-only, inside `StudentAcademiaView`; tree via `loadAcademiaTree` / `loadSessions`.
- Question card: `academia_activities` gains a nullable `game_link_code`; `assignToAcademia` writes one activity with both codes. New route `/academia/activity/$activityId` with Practice/Play choice; existing separate game activities are merged into their question card.
- Link fix: check `ensureGuestLink` kind/resource/class for Academia assignments against `/api/public/guest/$slug`.
- Timer: migration sets `timer_enabled = true` default and updates existing rows; remove checkbox in `AssignmentTimerPanel.tsx`; guest/student boards treat timer as always on.
- Colours: swap default `permanentAchievementColor` / `currentAttemptColor` values used by `PresentationView.tsx`.
- Flow: add `characterMode` to position settings in `src/lib/flow/types.ts`, selector in `FlowSetupPage.tsx`, applied in `FlowOverlay.tsx`; `FlowTrail.tsx` trims points by cumulative pixel length instead of point count.
- Solution heading: investigate the generator output and `questionPairs.ts` / heading repair.
- Verify each item in the browser where possible and report what was and wasn't checked.
