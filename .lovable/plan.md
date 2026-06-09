# Assessment Assignment System + Floating Number Scoring

Turns Lesson Notes into class assignments. The teacher assigns from a Solution; the student receives only the **question** plus the floating chips, builds each line by rearranging chips, and earns marks line-by-line. The correct answer is never sent to the student — grading happens server-side.

## How it behaves

**Teacher — Assign**
- A compact `👥` Assign icon appears on every **Solution** heading, beside the existing `AI` and `Floating` chips.
- Clicking it opens a small dialog: choose the class, confirm the auto-detected type (Classwork / Homework / Assessment / Practice from the parent section), and confirm the title.
- On confirm, the system gathers the parent **question** (not the solution) plus any same-kind sibling questions grouped via the existing "+ Add another" relationship, and creates **one assignment board** from them. Unconnected sections become separate assignments.
- Students receive the question + floating chips + per-line marks. They never receive the solution, marking key, or teacher notes.

**Teacher — Scoring (in the Floating Numbers workspace)**
- A scoring control is added to the top toolbar with a label picker (Marks / Points / Score / Credits / Reward).
- **Equal mode:** enter "Marks per line"; every line gets that value (20 lines × 3 = `Total Available 60`).
- **Individual mode:** each equation line shows an editable `[n]` box on its right; the teacher can set any line individually.
- **Total Available** recomputes automatically on every change. Marks persist with the floating lines.

**Student — Assessment Workspace**
- New section on the class page lists assigned tasks grouped by type (Classwork / Homework / Assessment / Practice).
- Opening a task shows: Question, Floating Number Workspace, Progress Tracker (`Line 1 ✓ / Line 2 □ …`), Current Score (`0 / 60`), and Save.
- Students rearrange the supplied chips for each line. When a line's arrangement is checked, the server awards that line's marks and the score/tracker update live. Lines can be solved in any order.
- Save stores progress, solved lines, and score; returning later restores the saved state automatically.

**Teacher — Monitoring**
- An Assignments view shows, per student: opened/not opened, current score, and completion — without exposing the marking logic.

## Grading rule (constrained, not a CAS)
Because students only rearrange chips taken from the teacher's line, validation is a constrained relationship check:
- Split the teacher line and student line on `=`.
- Normalise each side to a multiset of signed terms.
- **Accept** side-swaps and additive reorderings (`A+B=C` ≡ `C=B+A`, `2x=10` ≡ `10=2x`).
- **Reject** anything that moves a term across `=` or changes the relationship (`A+C=B`).
- No new symbols/operators are possible, so the valid set stays small.

## Phases
1. **Database + grading**: new tables (`assessments`, `assessment_answer_keys`, `assessment_progress`), scoring column on subsections, and a `grade-assessment` edge function holding the hidden key.
2. **Teacher scoring UI**: label picker, equal/individual modes, per-line `[n]` boxes, live Total Available, persistence.
3. **Assign flow**: Assign icon + dialog on Solution headings; build assignment(s) from grouped questions; hidden answer key.
4. **Student Assessment Workspace**: task list, board, chip workspace, progress tracker, live score, save/restore.
5. **Teacher monitoring**: per-student progress view.

## Technical notes

**Schema (migration tool)**
- `assessments`: `id, class_id, owner_id, notebook_id, section_id, kind, title, score_label, total_marks, questions jsonb`. `questions` is the student-safe payload only: `[{ id, questionText, lines: [{ lineId, chips: string[], marks: int }] }]` — never includes the correct arrangement.
- `assessment_answer_keys`: `assessment_id, lines jsonb` (`[{ lineId, equation }]`). RLS: readable by owner + `service_role` only; grading function uses `service_role`.
- `assessment_progress`: `assessment_id, student_id, solved_lines jsonb, score int, status text`. RLS: student manages own row; class owner may read (via `is_class_owner`). Add to `supabase_realtime` publication.
- Each new public table gets GRANTs (authenticated + service_role; no anon) per the standard four-step pattern.
- `notebook_subsections`: add `floating_scoring jsonb` (`{ label, mode: 'equal'|'individual', marksPerLine }`); add `marks?: number` to the `FloatingLine` type and persist within `floating_lines`.

**Edge function `grade-assessment`** (`supabase/functions/grade-assessment/index.ts`)
- Input: `{ assessmentId, questionId, lineId, arrangement: string[] }`. Auth via caller JWT (membership check), then reads the hidden key with service role.
- Runs the constrained-equivalence check (port the side-split + signed-term-multiset logic; reuse helpers from `src/lib/smartboard/canonical.ts` / `equivalence.ts`).
- Updates `assessment_progress` authoritatively and returns `{ correct, score, totalMarks, solvedLines }`.

**Teacher scoring UI**
- Extend `FloatingNumbersPage.tsx` toolbar with the label dropdown + mode toggle + "Marks per line" input + live Total Available; add a per-line `[n]` editor to `FloatingWorkspace.tsx`. Persist via the existing autosave/`persist` path plus the new `floating_scoring` column.

**Assign flow**
- Add the `👥` button to `SectionHeading.tsx` Solution branch (next to `AI`/`Floating`). Reuse `getSolutionSource` / `serializeRangeAsMath` (already in `DocumentEditor.tsx`) to extract the parent question; reuse `resolveSubsectionId` to locate the solution subsection and read its `floating_bucket` + per-line marks.
- Grouping: same-kind repeated sections (e.g. Example 1/2/3 created via "+ Add another") collapse into one `assessments` row with multiple `questions`; otherwise one assignment each.
- Class list comes from `get_owned_class_codes` / `classes` where `owner_id = auth.uid()`.

**Student workspace**
- New route `/student/class/:classId/assessment/:assessmentId` → `AssessmentBoard.tsx`; add an "Assessments" section to `StudentClassPage.tsx`.
- Reuse the Smartboard floating chip rendering (`FloatingNumberPanel` patterns / `floatingExtractor`) for line building; call `grade-assessment` on each line check; reflect server-returned score/tracker. Save writes progress (grading already persists; Save is an explicit checkpoint). Restore from `assessment_progress` on load. Live updates via realtime on `assessment_progress` using the existing `ensureRealtimeAuth` pattern.

**Teacher monitoring**
- Add an Assignments list (reuse `StudentsPage`/class pages) querying `assessments` + `assessment_progress` for the class, showing status/score/completion only.
