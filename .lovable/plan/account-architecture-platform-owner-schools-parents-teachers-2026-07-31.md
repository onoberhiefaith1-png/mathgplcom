# Account Architecture: Platform Owner, Schools, Parents, Teachers, Students

One "Account" button in the same place for everyone. What it opens depends on who is signed in. Teachers and students get no Account button at all — they keep the workspace they already have.

## What each account sees

| Signed in as | Account button | Opens |
| --- | --- | --- |
| Platform Owner | Yes | Schools / Teachers / Parents / Students (platform management) |
| School | Yes | Teacher management: + Add Teacher, list, suspend, remove |
| Parent | Yes | Connected teachers: + Add Teacher, list, remove |
| Teacher | No | Nothing — students are managed inside Classes, as today |
| Student | No | Nothing — learning workspace only |

## 1. The Account button

Today the top-right button shows the signed-in username (`onoberhiefaith1`). It becomes a plain button labelled **Account**.

- Signed out: the button offers the four sign-in choices (School, Teacher, Parent, Student) exactly as now.
- Signed in as Teacher or Student: the button is not rendered at all.
- Signed in as Platform Owner / School / Parent: the button opens that role's Account panel.

## 2. Login flow

The sign-in page already has one page per account type. It gains an explicit **Login as** selector (School / Teacher / Parent / Student) at the top so a visitor picks the account type first, then enters email and password. After sign-in the user is routed to their own workspace (Platform → platform console, School → school workspace, Teacher → Teaching Hub, Parent → family workspace, Student → student classes).

## 3. Platform Owner

Your account (`onoberhiefaith1…`) is currently stored as a Teacher. It gets promoted to the single Platform Owner.

The platform console shows real data, not placeholders:

- Overview: total Schools, Teachers, Parents, Students, active vs expired subscriptions, new registrations.
- Schools tab: school name, contact email, subscription, status, teacher count, student count, parent count, date joined.
- Teachers / Parents / Students tabs: name, email, owning organisation (or "Independent"), status, date joined.
- Each row shows the registered email so you can contact the organisation directly (mail link). No button anywhere opens a customer's lesson notes, classes or student data.

## 4. School account

A School has the full teaching platform plus teacher management.

- **+ Add Teacher** offers two ways, as agreed:
  - *Invite by email* — the teacher receives a link, sets their own password, lands in a fresh empty workspace.
  - *Set a temporary password* — the school types name, email and a temporary password; the teacher can sign in immediately.
- Teacher list shows name, email, status (invited / active / suspended), class count, student count.
- Actions: suspend (blocks sign-in, keeps data), reactivate, remove (revokes access; content stays with the school), resend invite.
- Every added teacher owns a separate workspace: their own classes, students, lesson notes, reports. Teacher A never sees Teacher B's data.
- The School has **full access** to its own teachers' content — it can open and edit their classes, lesson notes and reports. It can never see another school's data.
- Subscription is held by the school and covers all its teachers.

## 5. Parent account

Same layout as School, smaller permissions.

- **+ Add Teacher** connects a teacher to the family (invite by email, or temporary password), and the parent chooses which of their children that teacher teaches.
- Teacher list with remove/disconnect. No school management, no platform lists.
- Parents keep Children, Progress, Assignments, Reports, Live Lessons and Teacher Messages.
- Parents only ever see their own children.

## 6. Teacher and Student accounts

- Teacher: no Account button, no duplicated student management. Workspace stays Lesson Notes, Teaching Hub, Live Teaching, SmartBoard, Assignments, Adventure, Assessment, Reports, plus student management inside Classes.
- Student: no Account button. Lessons, SmartBoard, Assignments, Adventures, Reports, Rewards, Profile only.

## Technical section

Additive changes only; no existing table is dropped or renamed.

**Database (one migration)**
- `user_roles`: insert `platform_owner` for your user id.
- `account_memberships`: reuse for school→teacher ownership; enforce `status` values `invited | active | suspended` and index `(org_id, status)`.
- New `teacher_invitations` (org_id, email, first/last name, invited_by, status, token, expires_at) with GRANTs, RLS scoped to the owning org, plus `service_role` for the invite/accept server functions.
- New `parent_teacher_links` (parent_user_id, teacher_user_id, child_user_id nullable, status) with GRANTs and RLS scoped to `auth.uid()`.
- Security-definer helpers: `public.is_org_owner(_org_id)`, `public.org_of(_user_id)`, `public.owner_can_access_user(_user_id)` — used by policies to avoid recursion.
- Extend RLS on `classes`, `notebooks`, `class_members` and report tables with an additional "school owner of this teacher's org" clause (full access), leaving existing owner policies untouched.
- Platform-owner reads are limited to account/subscription tables (`organizations`, `account_memberships`, `profiles`, `user_roles`) — deliberately not lesson/class content.

**Server functions** (`src/lib/accounts/*.functions.ts`, authenticated middleware)
- `inviteTeacher` / `createTeacherWithPassword` (admin client used only after verifying the caller owns the org), `suspendTeacher`, `reactivateTeacher`, `removeTeacher`, `acceptTeacherInvitation`, `linkParentTeacher`, `unlinkParentTeacher`, `platformStats`, `platformAccounts(kind)`.

**Frontend**
- `AccountMenu.tsx` → label "Account", role-aware content, hidden for teacher/student.
- New `src/components/accounts/TeacherManagementPanel.tsx` shared by School and Parent.
- `AdminConsole.tsx` wired to `platformStats` / `platformAccounts` with real tables.
- `RoleAuthPage.tsx` gains the "Login as" selector; new `/auth/accept-invite` route for invited teachers.
- `roles.ts`: capability rows for `manage_teachers` (school, parent) and `platform_admin`.
