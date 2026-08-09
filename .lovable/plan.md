# Make every workspace a real container

Your architecture document matches most of what MathGPL already does. This plan closes the places where it does not — chiefly that lesson notes and adventures are not yet tied to the workspace they were made in.

## What is already true (checked)

- One account, many workspaces: `my_workspaces()` + `profiles.active_org_id` drive the personal workspace and one workspace per accepted school; switching only changes context.
- Classes are already school-scoped: `classes.org_id` is filled automatically from the active workspace, so Royal May classes stay in Royal May.
- Assignments, assessments and class members hang off a class, so they inherit that isolation.
- The school side is oversight-only: teacher/student directories, `Open Workspace`, and school-scoped read functions that refuse to return anything outside the school.
- Leaving a school removes the membership only; the account, ID and other workspaces survive.

## The real gaps

1. **Lesson notes are not workspace-scoped.** A notebook records only its owner, so every note a teacher writes appears in all of their workspaces — Royal May notes show up in Brentwood.
2. **Adventures / games are not workspace-scoped.** Same problem as notes.
3. **The school building does not reach teachers.** A school's building is broadcast to students only; a teacher inside a school workspace still sees their personal building.
4. **The class-join school check is unconfirmed.** The join flow calls a gate function, but whether it actually refuses a student who is not a member of the class's school needs checking before anything is claimed. Step one is to verify it and only then change it.

## What gets built

### 1. Notes and adventures belong to a workspace

- Lesson notes and adventures gain the same workspace stamp classes already have, filled automatically from the active workspace at creation.
- Every list — Lesson Notes, Teaching Hub, Adventure library, pickers used when assigning work — shows only the current workspace's items.
- Existing material is treated as personal-workspace material, so nothing disappears for you today.
- Copying a note into a school (or checking one out) keeps working; the copy belongs to the workspace it was copied into, and the original stays where it was.

### 2. Workspace switcher reads like your document

Personal Workspace first, then one row per school, each labelled with the school name and ID. The active workspace is always named on screen, and entering a school opens that school's building and Teaching Hub.

### 3. School building applies inside the school

While a teacher or student is inside a school workspace, the school's configured building and background are what they see, and building settings are not offered there. Their personal workspace keeps their own building, unchanged.

### 4. School membership before class membership

After verifying the current gate, joining a class owned by a school requires school membership: a class code alone is never enough, and the message says so plainly ("You need to join Royal May Academy first").

### 5. Counting

School and teacher reporting counts **classes** and **unique students** separately, so a student in five classes is one student.

## Technical section

- Additive migration: `org_id uuid` on `notebooks` and `games`, defaulted by a `BEFORE INSERT` trigger calling `current_org_id()` (mirroring `classes_set_org`); existing rows keep `NULL` = personal. RLS gains a workspace clause: owner reads their own row when `org_id` matches the active workspace or is NULL for personal; school owners read rows whose `org_id` is their school (read-only). Grants unchanged for existing tables.
- Client reads in the lesson-note and game data layers filter on the active `org_id` (NULL for personal) instead of `owner_id` alone.
- `class_join_gate` inspected first; if it does not already assert `is_workspace_member(class.org_id)`, that assertion is added and the client surfaces the school name in the refusal.
- Building inheritance: the school-readonly homepage mode is applied whenever `useWorkspace().active` is a school the viewer does not own, for teachers as well as students; homepage settings controls are hidden in that state.
- Reporting SQL uses `count(distinct user_id)` for students alongside `count(*)` for classes.

## Verification

Sign in as a teacher, create a note in Personal, switch to a school and confirm the note is not there; create one in the school and confirm it is absent from Personal and from a second school. Confirm the school building shows inside the school workspace and the teacher's own building returns in Personal. As the school, open a teacher's workspace and see only that school's material. Try joining a school class as a non-member student and confirm the refusal.
