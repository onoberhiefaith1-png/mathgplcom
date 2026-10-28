# Teachers and students as real people with their own workspaces

Right now `/school/teachers` shows the whole Command Centre card grid first, and the "No teachers connected to this school yet" panel sits far below it. And opening a teacher shows a statistics summary, not that teacher's workspace. This makes the relationship read as a school dashboard instead of a directory of real people.

## Checked before writing this

- `/school/teachers` renders `SchoolPeoplePage` inside `SchoolShell`, which puts `SchoolCommandNav` (the ten large cards) above the list — that's why the empty state is pushed down the page.
- Directory data already exists: `school_teachers(_org_id)` and `workspace_students(_org_id)`.
- Opening a person already routes to `/school/teachers/$userId` and `/school/students/$userId`, but `SchoolMemberWorkspacePage` renders counts (classes, notes, assignments, progress) — no building, no Teaching Hub, no Community.
- The school building/background already broadcasts to school members through the `school-readonly` homepage mode; the pieces to render the school's rotating building inside an observed workspace exist.

## What gets built

### 1. Teachers is its own page, not a dashboard section

Clicking **Teachers** opens a dedicated page whose first thing on screen is the school's teachers:

- No teachers yet → "No teachers connected to this school yet." at the top of the page, and directly under it **Find a Teacher** and **Enter a code**.
- One or more teachers → their profile cards at the top (name, Teacher ID, school status, Open Workspace), and **Find a Teacher** / **Enter a code** underneath the list.

The Command Centre card grid no longer sits above this page; getting back is a plain **Back to School Command Centre** link.

### 2. Students works exactly the same

Same page shape: student profiles first, then **Find a Student** / **Enter a code** underneath. A student joins by code/request from the school and appears here once they accept.

### 3. Opening a teacher opens that teacher's workspace — view only

`/school/teachers/<id>` becomes the teacher's own school workspace as the teacher sees it:

- the school's rotating building and background at the top,
- their Teaching Hub for this school — classes, lesson notes, adventures, assignments,
- their Community presence,
- their reports and progress for this school.

Every authoring control is absent, not disabled: no create, edit, assign, build, or settings buttons anywhere on the page, with a persistent "Viewing <name>'s school workspace — view only" banner. The school stays signed in as the school; this is never impersonation.

### 4. Opening a student is the same shape

The student's own school workspace: the school building, their classes, assignments, adventures, Smartboard work and progress — everything they are doing, none of it editable by the school.

### 5. The teacher's own side stays the editable one

A teacher signs in to their universal (personal) workspace. The schools they belong to are listed at the top; picking one — Algebra Academy, New Zealand Academy — enters that school's workspace, where they create and teach normally. Each school workspace is a separate container: work made in one never appears in another, and returning to personal shows only personal work. One teacher owns their workspaces; nothing is shared between teachers.

## Technical notes

- `SchoolPeoplePage` stops rendering inside the card-grid shell: a lighter header (back link, title, subtitle, workspace chip) replaces `SchoolCommandNav` on `/school/teachers` and `/school/students`; the empty state and the Find/Enter actions move below the roster in one column so they appear in the same place whether the roster is empty or full. `SchoolCommandNav` stays on the school dashboard.
- `SchoolMemberWorkspacePage` gains the observed-workspace body: `RotatingAdventureScene` in `configMode="school-readonly"` (non-interactive) plus read-only Teaching Hub / Community / reports sections fed by `school_member_overview` and `school_member_classes`, with the existing stat tiles kept as a summary strip. Existing teacher/student panels are reused through a `viewOnly` flag so their action controls are not rendered.
- Additive SQL only if a section needs data the current functions don't return (e.g. a member's lesson-note and adventure titles scoped to the school): new `security definer` functions asserting `is_org_owner(_org_id)` first, following `school_member_classes`.
- The teacher-side switcher (`WorkspaceSwitcher` + `useWorkspace`) already scopes notes, adventures and classes by `org_id`; no data-layer change is needed there — it is verified, not rebuilt.

## Verification

As the school: Teachers shows the empty state at the top with Find/Enter under it; after connecting a teacher, that teacher's card is at the top and the actions sit below; Open Workspace shows the school building plus that teacher's school work with the view-only banner and zero edit controls. Repeat for a student. Then sign in as that teacher: their schools are listed, entering one gives full editing, and work made there does not appear in personal or in a second school.
