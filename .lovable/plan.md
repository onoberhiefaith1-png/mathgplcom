## Goal

Replace the scattered "chips-in-boxes" assignment page with the **real SmartBoard**, scoped to a single assigned question. The student meets the same board the teacher uses: the question sits at the top, the floating numbers are present, and they solve line-by-line with the full board tools. Each completed line is checked with a small per-line "Check" button — correct turns it **green and awards the marks**, wrong turns it **red so they keep trying**. Running progress and score sit at the top.

## What exists today

- `PresentationView` is the SmartBoard. It loads a whole notebook, builds the "beats" (the questions) and "reservoirs" (the floating numbers + answer key), lets the user write freely, drag floating numbers, use fractions, etc., and shows a per-line status rail.
- `AssessmentBoardPage` is a *separate, simpler* page that shows each line as a box of tappable chips. This is the "disjointed" UI to remove.
- `grade-assessment` (server) already holds the hidden answer key and grades one line at a time, awards marks, and saves progress. The correct answer never reaches the student. We keep this as the marking brain.

## The approach

Make the SmartBoard able to run in an **Assessment mode**, fed from the assignment (not the notebook), with marking done by the server.

### 1. Build the board content from the assignment
A new helper turns one assignment into SmartBoard content:
- One question "beat" per question in the assignment (the question text shown at the top of the board).
- The floating numbers come from the assignment's stored chips (these are already what students were meant to see — no answer leak).
- Each line carries only its `lineId` and its marks — **never the correct equation**. The student's device never receives the answer.

### 2. Add an "assessment" mode to the SmartBoard
`PresentationView` gains an optional mode where it renders from the supplied assignment content instead of a notebook, and where:
- All the writing/editing tools and floating numbers stay exactly as the teacher's board.
- Live class-mirroring and teacher-only controls are turned off.
- Each board line gets a small **Check** button. Tapping it sends that line to the server (`grade-assessment`), which compares it to the hidden answer and replies correct/incorrect plus the new score.
- Correct → the line locks **green** and the marks are added. Wrong → the line flashes **red** and stays editable so the student keeps trying. No marks are lost.

### 3. Progress + score at the top
A slim progress strip across the top of the board shows each line as a tick that turns green when solved, plus the running score (e.g. `6 / 10 Marks`). It restores automatically when the student reopens the assignment (already saved server-side).

### 4. Swap the student page
`AssessmentBoardPage` is rewritten to load the assignment and render the SmartBoard in assessment mode. The old chip-box layout is removed. Navigation from the class assignment list is unchanged.

## Security note

The correct answer stays on the server only. The student board is fed from the assignment's question text + shuffled floating numbers (which were always meant to be visible), and every "Check" is graded server-side. No answer equations are loaded onto the student's device.

## Technical details

- **New** `src/lib/assessments/assessmentBoardSource.ts`: builds `Beat[]` + `Reservoir[]` from an `assessments` row. Beats: one `problem` beat per question (`id = questionId`, `content = questionText`). Reservoirs: `beatId = questionId`, `fragments` = that question's chips in order, `lines[]` = `{ lineId, marks }` with **`equation` omitted** so no client-side self-grading is possible.
- **`PresentationView` props**: add `source?: { beats; reservoirs; title }` and `grading?: { kind: "assessment"; assessmentId; questions }`. When `source` is present, bypass `useNotebook`/`buildBeats`/`buildReservoirs` and use it directly; force `syncEnabled = false`, `role` non-teacher chrome off, hide `ActiveStudentControl`.
- **Line check**: in assessment mode, the per-line action calls `supabase.functions.invoke("grade-assessment", { assessmentId, questionId: activeBeat.id, lineId: reservoir.lines[k].lineId, arrangement })`, where `arrangement` = the written row parsed to terms via `extractTermsFromAscii(rowToAscii(row))`. Use the returned `solvedLines`/`score` as the source of truth; map solved lines → green bulbs in `LineStatusRail` (replacing the client `equationsMatch` path for this mode). Lines are validated in document order (kth board line → kth unsolved assignment line), matching the existing teacher in-order model.
- **Progress HUD**: new lightweight top bar component shown only in assessment mode, reading `solved`/`score`/`total_marks` (seeded from `assessment_progress`, updated from each grade response and the existing realtime subscription).
- **`AssessmentBoardPage`**: replace body with assignment load → `assessmentBoardSource` → `<PresentationView source=… grading=… classId=… role="student" />`. Keep the auth/membership redirect and progress restore.
- **`grade-assessment`**: no schema change. It already accepts an `arrangement` array and does multiset/relationship matching, which tolerates the reordered terms a free-written line produces.
- No database migration required — `assessments`, `assessment_answer_keys`, `assessment_progress` already hold everything.
