# Student workspace viewing: reuse the Student Dashboard

Today, School Console → Students → a student opens the old "My Classes / Join Class" page (which reads "no classes yet"), and Teaching Hub → Students → a student opens a separate teacher-built page listing shared classes. Both should open the existing Student Dashboard, read-only, scoped to the viewer's context.

## What changes

1. School viewing a student
   - `/school/students/:userId` renders the real Student Dashboard inside the existing read-only viewing frame instead of the classes/join page.
   - Mirror the dashboard's sub-pages so links stay inside the mirror: My Classes, Assignments, Adventure, Skill Builder, Join Class (shown but inert), Go Live (shown but inert), and a class detail page.
   - Data is already workspace-scoped: while viewing, the school's own workspace is the scope, so only that school's classes, assignments, adventures, skill builders and progress appear. Other schools' activity never loads.

2. Teacher viewing a student
   - `/teaching-hub/students/:userId` renders the same Student Dashboard inside the same viewing frame, with the same mirrored sub-pages, replacing the current bespoke page.
   - Scope: the teacher's active workspace, further narrowed to classes the teacher owns or teaches. If the student is in five schools but the teacher teaches them in one, only that context's classes, work and progress are shown.

3. Read-only behaviour
   - The frame keeps the existing lock: any attempt to edit, submit, join or change settings shows the one-line refusal message. Join Class and Go Live appear (so the dashboard looks identical) but do nothing except show the message.
   - Top strip reads "Viewing <Name>'s workspace — Read only", labelled "Viewing as School" or "Viewing as Teacher" depending on who is looking.

4. The student's own account is untouched
   - `/student` and its pages keep full function and keep showing overall progress across every school and class they belong to.

## Technical notes

- Reuse `ViewAsProvider` / `viewAsScope.ts`. Add a `viewer` kind (`school` | `teacher`) for the strip label, and extend `mapViewAsPath` so `/student/*` paths (assignments, adventures, skill-builder, join, classes, class/:id) fold into the mirror base rather than collapsing to the hub.
- School mirror base stays `/school/students/:userId`; new teacher mirror base `/teaching-hub/students/:userId` with the same child route files (index, classes, classes/:classId, assignments, adventures, skill-builder, join).
- `src/lib/student/allClasses.ts` already resolves owner via `viewOwnerId` and workspace via `activeSchoolOrgId`, which returns the viewing scope's `orgId` — school scoping works as-is. For the teacher viewer, add an optional class-restriction in the scope (class ids owned/taught by the viewer) applied inside `myClasses`, so every downstream list and progress figure narrows with it.
- `useLearning` query keys gain the viewed owner id so the viewer's own cached student data is never reused.
- Progress numbers come from the same `student_course_progress` rows, averaged over the scoped classes only — no new tables, no schema change.
- Existing school route `school/students/:userId/classes/:classId` is kept and reused.

## Out of scope

No changes to connections, join codes, class content, grading, or the teacher/school dashboards themselves.
