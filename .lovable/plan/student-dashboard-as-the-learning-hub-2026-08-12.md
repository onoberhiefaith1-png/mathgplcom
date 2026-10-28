# Student Dashboard as the learning hub

Students currently land on **My Classes / Join Class**. This makes the Student Dashboard the front door and adds global, cross-class views for Assignments, Adventures and Skill Builder — reading only content teachers already created. Nothing on the teacher, school or shared-workspace side changes.

## New flow

```text
Sign in -> Building -> Student Dashboard (/student)
  My Classes      -> a class -> that class's content only (unchanged pages)
  Assignments     -> assignments from ALL enrolled classes
  Adventure       -> adventures from ALL enrolled classes -> plays the teacher's adventure
  Skill Builder   -> skill builders from ALL enrolled classes
  Join Class      -> existing join panel (kept, no longer the landing page)
  Go Live         -> connect with a school or a teacher (existing connection model)
```

## Dashboard content

- **Overall progress** plus **per-class progress**, using the existing student progress source (`student_course_progress`) already used by the student stats function — no new progress formula.
- Cards for My Classes (each class with its own progress and a link into the class), Assignments, Adventure, Skill Builder, Join Class, Go Live.
- Removed: the Quick actions strip and the school/teacher rail cards that read as management sections. My Schools / My Teachers stay reachable from the Go Live + connections area only.
- Join Class opens the existing join panel (as a section on a dedicated page), unchanged in behaviour.

## Global (all-classes) pages

Three new student pages, each fanning out over the student's enrolled classes and grouping rows under the class name, with a link into the existing per-class item:

| Page | Route | Reads | Opens |
| --- | --- | --- | --- |
| Assignments | `/student/assignments` | assigned assessments per class (same query the class page uses) | existing `/student/class/$classId/assignment/$notebookId` |
| Adventure | `/student/adventures` | class adventures per class | existing class adventure/play route — play only, never an editor |
| Skill Builder | `/student/skill-builder` | class course pathway per class, respecting the teacher's sequential/free lock rules | existing course runner route |

## Permissions

Student pages stay read/play only: no create, edit, assign or delete affordances anywhere in these views. Class-side gating (visibility flags, sequential unlock, school-owned class join gate) is reused as-is, so a student never sees content outside their enrolled classes.

## Technical notes

- `WORKSPACE_PATH.student` becomes `/student`; the homepage student button and `ROLE_NAV.student` gain Dashboard, Assignments, Adventure, Skill Builder, Join Class.
- `src/pages/accounts/StudentDashboard.tsx` is rewritten on the existing `WorkspaceLayout` / `DashboardHero` / `StatCard` primitives, keeping current MathGPL styling.
- New shared helper (e.g. `src/lib/student/allClasses.ts`) resolves the student's enrolled classes for the active workspace and fans out the per-class queries already implemented in `StudentClassPage`, `classAdventures` and `classCourses` — no new tables, no migration.
- `StudentClassesPage` keeps Join Class; a `/student/join` route surfaces the same panel from the dashboard.
- Go Live for students reuses `GoLiveToggle` and the existing connections/requests pipeline (school + teacher relations), with no new capabilities granted to the connected side.
- Workspace isolation (`activeSchoolOrgId`) and the school's read-only student mirror (`viewOwnerId`) continue to apply to every new page.
