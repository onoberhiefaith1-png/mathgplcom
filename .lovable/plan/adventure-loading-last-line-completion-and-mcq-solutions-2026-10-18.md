# Adventure loading, last-line completion, and MCQ solutions

## 1. Adventure: everything loads before Start
- Before the "Start Adventure" button is enabled, preload the video, every narrator clip, the Game music, and the Game for each learning point. A progress ring shows "Getting ready…".
- Reuse the same preloaded Game across learning points instead of opening a fresh copy, so there is no wait between stages.
- Files are kept on the device, so later plays (and Mathemagine offline) start straight away.
- On Start, music and narrator begin together at the teacher's levels.

## 2. A question finishes only after the last line is solved
- First, check your recent attempt to find exactly why it finished with the last line unsolved (likely causes: the last line counted as "note only" / no Floating Numbers, or Finish triggered on reaching the last row).
- Fix it so every line with Floating Numbers must be solved, the last line included. Full marks (100%) is the default everywhere: Academia Practice/Play, Adventure, and offline.
- Add a test: a question with its last line unsolved is never complete.

## 3. MCQ papers in Academia: one full list
- Remove the "rows of 10" choice from the Academia Add Paper screen. A 50-question paper is saved and shown as questions 1–50, and students move freely from 1 to 50.

## 4. Assign to MCQ = link a solution to an existing question
- In the lesson note, "Assign → Multiple Choice" asks for: Class, Subject, and the paper's name.
- The paper's questions then show in groups (1–10, 11–20, 21–30…). Open a group, pick one question, and the lesson-note solution (with its Floating Numbers) is linked to that question. The question text itself is not copied — it stays the paper's question.
- Linking again replaces that question's solution.

## 5. Student MCQ screen with a mini Smartboard
- Layout from top to bottom: Question, Solution (only if a solution is linked), Options.
- No linked solution means no Solution button.
- Tapping Solution opens a mini Smartboard between the question and the options: the same student writing surface with Floating Numbers, marked line by line just like the Smartboard. It grows as the student works and pushes the options down.
- After solving, the student picks an option and moves on. Only the option counts toward the paper score.
- This applies to full papers and Session MCQ cards. Game and Adventure are not involved.

## Technical notes
- New nullable `solution` jsonb column on `academia_mcq_items` and on paper questions (copied lines with id/marks/chips/arrangement), plus a grant-safe additive migration; no data dropped.
- The mini board is compiled with `compileOfflineBoard` from the linked lines, then mounted inline in the existing student board component (not a dialog). It replaces the current text pad `McqSolutionDialog`.
- Adventure preload: `Promise.all` over video `canplaythrough`, `fetch` of narration/music into the audio cache, and a single embedded Game instance kept mounted and fed a new board for each point.
- Completion fix goes in `src/lib/game/runtime/completion.ts` and its callers. These are locked Game files, so the change is limited to the completion rule and noted for your review.
- Tests: completion rule, MCQ link replace, paper saved without range split.
