# School's read-only view of a teacher's Shared Workspace

The teacher side stays exactly as it is. The only change is what a school administrator sees after School Console → Teachers → a teacher → Open Shared Workspace.

## What replaces the current page

Today that page shows a stats dashboard (Classes, Students taught, Lesson notes, Assignments, Adventures, Average progress) plus a building preview with an "Edit Building" button. That becomes:

- A header with the teacher's identity, the school name, and a clear "View only" badge.
- Five primary sections, matching the teacher's Teaching Hub exactly:
  1. Lesson Notes
  2. Smartboard
  3. Classes
  4. Adventure
  5. Skill Builder
- No top-level Students, Assignments, or Average Progress.
- No "Edit Building" button anywhere on this page. The Building stays editable only from the School Console, and is described as school-wide.

## Each section, opened from the school side

All of these read only material the teacher created **inside this school's shared workspace** — the teacher's personal workspace never appears.

- **Lesson Notes** — the teacher's notes in this school: cover, title, topic, updated date. Opening one shows its content in read-only mode (no editing toolbar, no AI controls, no save).
- **Smartboard** — the teacher's smartboard activity in this school's classes, live where a session is running, otherwise the last saved board. Display only; no drawing, no interaction that writes.
- **Classes** — the teacher's classes in this school. Opening a class reveals the class-level detail (students, assignments, activity, progress) as read-only. Any create/edit control is disabled with the message: "Teacher Action Required — Only the teacher can create or edit classes in this workspace."
- **Adventure** — adventures the teacher built in this school, viewable, not editable.
- **Skill Builder** — the teacher's courses in this school, viewable, not editable.

Each section is its own school-side page under the teacher, with breadcrumbs back to the teacher and to Teachers.

## Technical notes

Routes (new, all read-only, school-owner gated):
```text
src/routes/school/teachers/$userId/
  index.tsx          five-section hub (replaces the stats dashboard)
  lesson-notes/index.tsx, lesson-notes/$noteId.tsx
  smartboard.tsx
  classes/index.tsx, classes/$classId.tsx
  adventure.tsx
  skill-builder.tsx
```
`SchoolMemberWorkspacePage.tsx` is rewritten as the hub for `kind="teacher"`; the student variant keeps its current shape. Pages live in `src/pages/school/shared/` with a shared `SharedWorkspaceShell` (identity header, view-only banner, section nav) and a `ReadOnly` context that suppresses authoring controls when existing viewers are reused (Lesson Note viewer, class dashboard, adventure/course viewers).

Data: every read is scoped by `org_id = <school org>` **and** `owner_id = <teacher>`, reusing existing patterns in `src/lib/accounts/schoolDirectory.ts`. Existing policies already allow a school owner to read `notebooks`, `games`, `classes`, and `class_members` in its workspace.

Additive migration needed for the content the school cannot currently read (school-owner SELECT only, no write):
- `notebook_sections`, `notebook_subsections`, `notebook_blocks` — so a note's content is viewable.
- `courses`, `course_sections`, `course_blocks` — Skill Builder.
- `class_smartboard_state` — Smartboard viewing.
- `learning_assignments`, `student_course_progress`, `adventure_groups` — class detail read-outs.

No existing policy is dropped or loosened; nothing grants the school write access. Teacher-side files (`workspaceNav.ts` TEACHER/SHARED_TEACHER groups, Teaching Hub pages) are not touched.

## Acceptance

School enters a teacher's shared workspace, sees the five sections, opens each one and finds that teacher's real school-workspace content with no editing controls; teacher-side Teaching Hub and personal workspace unchanged.
