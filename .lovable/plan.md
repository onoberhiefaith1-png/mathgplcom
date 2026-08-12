# Parent Hub: family management without owning the student

The parent becomes a family hub: guardian, observer and connection manager. Every account stays independent — the student still owns the student account, and schools and teachers keep their own workspaces.

## 1. What the parent gets

**Parent Hub (`/family`)** replaces the current Family dashboard tiles:

- Header stats: children, schools connected, teachers connected, average progress across children.
- **My Children** table/cards: child name, schools count, teachers count, overall progress, "View Details".
- **Schools Connected** and **Teachers Connected** lists, each showing how many of the parent's children they cover.
- Quick actions: Add a Child, Connect a Child to a School, Connect a Child to a Teacher.
- Go Live card, same connection model as the teacher side.

**Child overview** — clicking a child opens the child's real Student Dashboard, read-only, inside the existing viewing frame at `/family/children/{childId}`: overall progress, My Schools, My Teachers, Classes, Assignments, Adventures, Skill Builder, Reports. Banner reads "Viewing Student Workspace — Read Only (Parent)".

Progress: each child shows the full cross-school total, expandable into a per-school and per-teacher breakdown.

## 2. Connection rules

| Parent action | Who approves |
| --- | --- |
| Connect to my child | The student accepts |
| Connect Child A to a school | The school accepts, then the child confirms |
| Connect Child A to a teacher | The teacher accepts, then the child confirms |

- A parent request for a child always names which child it is for; the child appears in the request sentence on both sides ("@parent asked to connect Daniel to your school").
- A connection only becomes active after both the school/teacher and the child have accepted. Until the child confirms, both sides see "Waiting for the student to confirm".
- The parent never becomes a member of the school or teacher workspace: no class creation, no lesson-note editing, no school administration.
- Same-role connections (school–school, teacher–teacher, student–student) stay forbidden. Parent–parent is likewise refused.

## 3. What a parent can never do

Do the child's assignments, play an Adventure as the child, submit work, edit any teacher or school content, or create a class or school. Every write inside a child's workspace is refused with the existing lock sentence.

Each child keeps a completely separate arrangement — children need not share a school or teacher, and one child may have several of each.

## 4. Data isolation

- Parent sees: their own children, and the schools/teachers those children are connected to.
- School sees the child only within that school. Teacher sees the child only through the classes they teach. Nothing leaks between them, and nothing about other families is visible.

## Technical section

**Database (one additive migration)**
- `connections`: add `child_user_id uuid` (nullable) and `child_confirmed_at timestamptz`; index `(child_user_id, status)`.
- `request_connection_for_child(_child_user_id, _target_user_id, _relation, _message)` — security definer; verifies the caller is `parent` and has an accepted `parent_child` link to `_child_user_id`, and that the relation resolves to `parent_school`/`parent_teacher` for the pair.
- `respond_to_connection` extended: for rows with `child_user_id`, the counterpart's accept moves the row to awaiting-child, and the child's accept sets `child_confirmed_at` and status `accepted`. Either party's decline revokes.
- `my_connections` returns the two new fields plus `child_name`; `my_connection_counts` keeps `children`.
- New `parent_child_overview(_parent_user_id)` returning one row per child: `child_user_id`, display name, school count, teacher count, overall progress, plus a companion `parent_child_school_breakdown(_child_user_id)` for the per-school/per-teacher split.

**Frontend**
- `src/lib/connections/connections.ts`: `Connection` gains `childUserId` / `childName` / `childConfirmedAt`; add `requestConnectionForChild`; `requestSentence` gains child-aware wording and an "awaiting student confirmation" state; `relationFor` returns null for parent–parent.
- `src/lib/family/useFamily.ts` (new): hooks over `parent_child_overview` and the breakdown RPC.
- `src/pages/accounts/FamilyDashboard.tsx`: rebuilt as the Parent Hub described above using existing dark card primitives (`SectionCard`, `DashboardShell`) — no new visual language.
- `src/components/family/ConnectChildDialog.tsx` (new): pick child → pick school/teacher by @username or share code → send.
- `src/lib/accounts/viewAsScope.ts` + `src/components/school/ViewingFrame.tsx`: `viewer` union gains `"parent"`, base path `/family/children/{childId}`, `mapViewAsPath` folds `/student/*` into it (mirroring the existing school/teacher student mirror).
- `src/routes/family/children/$childId/` mirror routes (index, classes, assignments, adventures, skill-builder) rendering the real student pages inside `ViewingFrame`, matching `src/routes/school/students/$userId/`.
- `src/pages/connections/RequestsPage.tsx`: child-scoped requests show the child's name and the two-stage status.
- `src/components/workspace/workspaceNav.ts`: PARENT group becomes My Children / Schools / Teachers / Reports / Requests.
