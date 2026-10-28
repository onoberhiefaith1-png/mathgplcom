# Finalise the School–Teacher Shared Workspace

The connection pipeline stays exactly as it is. This change makes the space created by an accepted school–teacher connection behave as its own workspace, clearly separate from the teacher's personal one.

## The model being enforced

```text
Teacher account
 └── Personal Workspace          (teacher-owned: Building + everything)

School account
 └── One school container        (school-owned Building, School Console)
      ├── Teacher A Shared Workspace   = school Building + Teacher A's teaching
      ├── Teacher B Shared Workspace
      └── ...
```

A Shared Workspace is identified by the pair (school, teacher). No new container is created per teacher: the school container plus the teacher's own authorship already defines the pair, so no duplicate "My School" can appear and existing data is untouched.

## 1. Teacher inside a school: teaching-only navigation

When a teacher's active workspace is a school they were connected to (not their own), the sidebar shows only:

Lesson Notes, SmartBoard, Classes, Adventure, Skill Builder, MathGPL Live.

Removed in that context: Building management, building/homepage settings, and personal-workspace-only controls. The school's Building is still what they land on and can look at — they just have no editing entry point.

In their Personal Workspace the teacher keeps the full current navigation, including Building.

## 2. Clear context header

Inside a school workspace the teacher sees, above the navigation:

```text
My School / Faith Gabriel
Shared Workspace
```

with the school name, the teacher's real name and their avatar, so the space can never be mistaken for the personal workspace.

## 3. Building ownership

- School owner: can open and edit the school Building (unchanged).
- Connected teacher: Building is view/use only. The Building editor route refuses to open when the active workspace is a school the person does not own, and instead explains that the school controls it — so the rule holds even if the URL is typed directly.

## 4. Data separation

Teaching material keeps using the existing workspace stamp: rows created in a school workspace carry that school, rows created personally carry none, and every list filters by the active context. Per-teacher separation inside one school comes from authorship, so Teacher A never sees Teacher B's teaching material. This audit covers lesson notes, classes, adventures, games, assignments, SmartBoard shelves, Skill Builder courses and Live sessions; any list found reading unscoped is corrected in the same pass.

## 5. School administrator view

School Console → Teachers → a teacher opens that teacher's Shared Workspace (never their Personal Workspace). It shows the teacher's real name and avatar, the school Building with an Edit Building action for the school, and their teaching activity inside this school — classes, lesson notes, adventures, assignments, progress — as view only, with no authoring controls rendered. Reads stay school-scoped and the administrator is never signed in as the teacher.

## 6. Identity: real name and avatar

Everywhere a teacher is shown in the school interface (roster cards, shared workspace header, teacher page):

- Name comes from the registered first and last name; never an email address and never a username fallback.
- Avatar shows the uploaded picture when there is one, otherwise the initials from first + last name (Faith Gabriel → FG). Never an empty box, broken image or unrelated icon.
- Uploading a picture later replaces the initials automatically.

The MathGPL ID stays visible only to the school administrator, not as a display name.

## Technical notes

- Nav: `navGroupsFor` gains the shared-workspace case (role `teacher`, workspace `kind === "school"`, `isOwner === false`) returning the six teaching items; `WorkspaceLayout` passes the ownership flag from `useWorkspace()` and renders the "School / Teacher · Shared Workspace" header with an avatar.
- New shared `TeacherIdentity` helper (name from `profiles.first_name`/`last_name` with `display_name` fallback, initials, avatar URL) used by `SchoolPeoplePage`, `SchoolMemberWorkspacePage` and the shared header, replacing the current icon placeholder.
- `school_member_overview` extended additively to return `first_name`, `last_name`, `username` and `avatar_url`; `fetchMemberOverview`/`MemberOverview` updated to carry them.
- Building guard: `HomepageBuildingPage` (and the Replace Building / Background pages) check `useWorkspace().isPersonal || role === "school"` before rendering the editor.
- Scoping audit across the `activeSchoolOrgId` / `scopedByWorkspace` call sites (`LessonNotesPage`, `games.ts`, `SmartboardShelf`, `CreateSessionPage`, `LinkAdventureDialog`, `stats.ts`) plus the Skill Builder and Classes lists, adding the owner filter where a school workspace list currently shows all teachers' rows.
- No changes to connection request/accept flows, `account_memberships`, or org creation.

## Verification

Sign in as the teacher: Personal Workspace has Building; switching to My School shows the Shared Workspace header and only the six teaching items, and `/homepage/building` refuses to edit. A note created in the school workspace is absent from Personal and vice versa. Sign in as the school: both connected teachers appear with real names and initials/photos, opening one shows the Shared Workspace with an editable Building and view-only teaching content.
