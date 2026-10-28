# Evaluation + Notes on the Test Smartboard (and notes for students)

Three connected fixes. No rebuild of the Smartboard, the marking engine, the Evaluation panel or the Floating Number page.

## 1. Evaluation does not work on the test board

Confirmed cause (two things, both specific to the test sitting):

- The board publishes its live snapshot and every check result on a realtime channel configured with `broadcast: { self: false }` (`PresentationView.tsx`). On the test board the board and the Evaluation panel are the **same browser tab**, so every message the board sends is discarded before the panel can see it. In the real case (teacher viewing a student) they are two different devices, which is why it works there.
- The panel's second source — the saved board-state row — is always empty in test mode, because a test deliberately persists nothing.

Fix: add a same-page live bridge. The board publishes each snapshot and each check verdict to a tiny in-page event channel at exactly the same moments, with exactly the same payload it already broadcasts. The Evaluation panel, when it is running in the same page as the board (the test sitting), listens on that bridge in addition to the realtime channel.

Result: QUESTION · LINE, EXPECTED LINE, STUDENT LINE (LIVE), AI EVALUATION and STUDENT-INTRODUCED TERMS update while the teacher writes, identical to the student-work view. Remote teacher viewing stays untouched.

## 2. Notes do not appear on the test board

Confirmed cause: teaching notes live on the highlight that authored them (`precedingNotebook` on the subsection's saved highlights), and the note law is "a note belongs to the highlight above it". The lesson-note board reads them. The **assessment/test** path does not: the question compiler builds each line from equation, chips, containers and marks only, and drops the note entirely, so by the time the test board exists there is no note to show.

Fix: carry the note through the one pipeline that was dropping it.

- The compiler attaches each line's own note (and standalone note-only lines) to the question it builds, using the same "note belongs to the highlight above" law the lesson board uses — no second note source, no positional guessing, no explanation fallback.
- The board-source builder passes that note onto the board line, so the existing note machinery lights up unchanged: the note marker on the Floating Number panel, the reveal, the write-to-board action, the row lock and the note gate.

Because the note is read through the existing single note source, an icon on the panel still means a real note, and no note still means no icon.

## 3. Notes for students while they solve

Same root cause, same fix — the note channel on the board is already role-neutral; it was starving because notes never reached assessment questions.

Once notes travel with the question:

- A student on an assignment board sees the note marker on the lines that have a note, opens it, and writes it onto their own board with the existing action.
- The note glows for attention and behaves like it does for the teacher: the note has to be opened before moving to the next line, so it is never skipped.
- Lines with no note are completely unchanged — no marker, no gate, nothing new on screen.

## Technical notes

- `src/lib/assessments/createAssessment.ts`: `compileSectionQuestions` (and the notebook-wide variant) read `floating_bucket` highlights alongside `floating_lines` and emit `note` / `noteOnly` per line in `QuestionPayload`.
- `src/lib/assessments/assessmentBoardSource.ts`: map `note` → `ReservoirLine.notebook` and `noteOnly` → `notebookOnly`, so `noteForLine` and the existing gate work with no change.
- New small module (e.g. `src/lib/smartboard/localLiveBridge.ts`): a typed in-page publish/subscribe for the `board` and `check` payloads.
- `src/components/smartboard/PresentationView.tsx`: publish to the bridge next to each `ch.send` (live snapshot, heartbeat, manual/auto check, live check). No change to what is sent.
- `src/components/smartboard/TeacherReasoningPanel.tsx`: optional `localLive` prop; when set, subscribe to the bridge as an additional feed with the same freshness rules.
- `src/pages/floating/FloatingTestBoardPage.tsx`: pass `localLive` to the panel.
- No migration. No change to marking, scoring, persistence rules or the test sitting's "nothing saved" guarantee.

## Verification

Open a solution with a highlighted note → Test on Smartboard: the note marker appears on that line, opens and writes to the board; Evaluation fills in and updates live as lines are written and checked; leaving and re-entering still starts blank; a real student assignment board shows the same note behaviour.
