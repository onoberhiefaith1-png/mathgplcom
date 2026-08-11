# School Console, teacher connections and Shared Workspaces

No redesign. This corrects terminology, fixes the confirmed reason your connected teachers do not appear, and makes the shared school–teacher environment a real, separate container.

## What I verified in your data

- Both teacher connections are genuinely accepted: `school_teacher`, status `accepted`, pointing at the school container `My School`.
- Both teachers are already active members of that container (TCH/000005 "My Teacher", TCH/000007 "faith Faith").
- Your school account owns **two** school containers: `My School` (the 2 teachers) and an empty duplicate `My School workspace`.
- Your account's active container is the **empty duplicate**, and the Teachers page reads only the active one. That is why the list looks empty even though the connections worked.
- Lesson notes, adventures/games and classes already carry a container stamp, so content separation has a foundation to build on.

## 1. One school container

`My School` — the one holding the two connected teachers — becomes the canonical school container. The empty duplicate is retired: any row that references it is repointed to the canonical container only where an equivalent row does not already exist, then the duplicate is removed. Your school account's active container is set to the canonical one.

Teacher personal containers are untouched: nothing from a teacher's personal Building or Teaching Hub is merged into the school. Connections, memberships and permissions are preserved exactly.

Then it is made impossible to end up here again: a school account gets at most one school container, so account bootstrap never creates a second one.

## 2. Terminology

- School account's administrative area is **School Console** everywhere (no Teaching Hub anywhere in school navigation).
- School Console navigation: Dashboard, Building, Teachers, Students, Reports, Account.
- A teacher's private environment is **Personal Workspace**.
- The environment created by a school–teacher connection is **Shared Workspace** (never "the teacher's workspace").

## 3. Teachers section fixed

School Console → Teachers lists every teacher with an accepted connection to this school, sourced from the real connection/membership data — no hardcoding. Each card shows the teacher's **@username** and registered name, avatar when they have one, teacher status and connection status. Email addresses are never shown as a name.

Clicking a teacher opens their school-connected profile, which states plainly that this teacher is connected to the school and offers one action: **View Shared Workspace**.

## 4. Shared Workspace

Per your decision, the school is one container and each connected teacher has their own Shared Workspace area inside it: the school's Building plus that teacher's Teaching Hub within the school relationship. It is created (or, for your two existing connections, backfilled once) on acceptance, and exactly one exists per school–teacher pair.

Contents — lesson notes, classes, assignments, adventures, games — belong to the Shared Workspace. They never appear in the teacher's Personal Workspace, and personal material never appears in the Shared Workspace. Reads on both sides filter by container, so creating in one cannot touch the other.

## 5. Permissions

- **School**: administrator. Views everything in the Shared Workspace — Building, Teaching Hub activity, lesson notes, games, assignments, adventures, classes, reports. Edits the **Building**. Cannot edit the teacher's teaching content; those controls are not rendered for the school at all.
- **Teacher**: operates the Shared Workspace. Full Teaching Hub authoring inside it. Cannot change the school's Building; building settings are absent for them there.

Every school view of a Shared Workspace is banner-labelled **Shared Workspace — <School> · <Teacher>**, so it can never be mistaken for a Personal Workspace.

## 6. Teacher-side navigation

The teacher's switcher distinguishes **Personal Workspace** from each **School Workspace** by school name. Switching actually reloads that container's data — Building, Teaching Hub, notes, classes — not a relabel of the same content.

## 7. Reports

School Reports keep their current shape and aggregate across the school's connected teacher Shared Workspaces, counting classes and unique students separately.

Student connections are out of scope in this change.

## Technical notes

- Data repair migration: pick canonical school org, repoint/merge rows from the duplicate where no equivalent exists, delete the duplicate org, set `profiles.active_org_id` to the canonical org. Guard in `ensure_account` / `handle_new_user_account` so a school account never creates a second school org.
- `school_teachers(_org_id)` extended to return `username` and avatar and to source teachers from accepted `school_teacher` connections joined to `account_memberships`, so an accepted connection can never be invisible; still asserts `is_org_owner`.
- Shared-workspace resolution helper (school org + teacher user id) used by school observation reads and by teacher-side scoping; `activeSchoolOrgId()` scoping in `workspaceScope.ts` is reused for teacher writes, and school reads add the teacher filter.
- Backfill: for each accepted `school_teacher` connection lacking an active membership, insert it idempotently (`ON CONFLICT DO NOTHING`) — no duplicates on repeat runs.
- UI: `SchoolCommandNav` / `SchoolShell` copy switched to "School Console" with the six items; `SchoolPeoplePage` teacher cards show `@username`; `SchoolMemberWorkspacePage` relabelled Shared Workspace with an explicit Building-editing entry for the school owner and no authoring controls.
- Building edit permission: school owner only inside a school container; teachers keep building settings in their Personal Workspace.

## Verification

Sign in as the school: exactly one school container in the switcher; Teachers lists both connected teachers by username; open one → Shared Workspace with the school Building, teacher's Teaching Hub contents, view-only teaching content, editable Building. Sign in as that teacher: Personal Workspace and the school workspace are separate; a note made in the school workspace is absent from Personal and vice versa; both survive refresh and re-login; no duplicate containers appear.
