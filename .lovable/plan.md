# School Command Centre — individual teacher and student workspaces

Go Live stays exactly as it is. This restructures the School Administrative Workspace around the real people connected to the school.

## Checked before writing this

- `ROLE_NAV.school` already lists Dashboard, Teachers, Students, Reports, Analytics, Accounts, Billing, Requests, Community, Account & Go Live, Settings — rendered as small pill links in `RoleShell`.
- `/school/teachers` renders `TeacherManagementPanel` in school mode, which still contains the First name / Last name / Email / Send invitation account-creation form.
- My Account shows both `ShareCodeCard` ("My Share Code") and `SchoolCodeCard` — the duplicate you saw.
- School membership lives in `account_memberships` (org_id, user_id, role, status). Both existing school workspaces currently have **only the owner** as a member — no teachers, no students — so the directory genuinely starts empty.
- `workspace_students(_org_id)` already returns a school's students. There is no equivalent for teachers yet.
- View-only today is workspace-wide (`useWorkspace().viewOnly`) and only triggers when a non-school role visits a school workspace. There is no per-person observation view yet; that is the main new piece.

## What gets built

### 1. One code for a school
Hide "My Share Code" on school accounts. A school shows only **My School Code** with Copy and Generate New Code. Other roles keep their Share Code unchanged.

### 2. No account creation from a school
Remove the Add Teacher form (names, email, send invitation, password path) from the school view of the teacher panel. The school connects to teachers that already exist: Find a Teacher (Community discovery) or Enter a Code. The Parent mode of that panel is untouched.

### 3. School Command Centre navigation
Replace the pill row on school pages with large labelled cards — title plus the one-line description you wrote for each of Teachers, Students, Reports, Analytics, Accounts, Billing, Requests, MathGPL Community, Account & Go Live, Settings. Existing gold/navy card styling, large touch targets, clear active state, responsive. Requests appears once.

### 4. Teachers = a directory of this school's teachers
`/school/teachers` becomes **Teachers in This School**: one card per connected teacher with name, Teacher ID, school status and **Open Workspace**. With none connected: "No teachers connected to this school yet." plus **Find a Teacher** and **Enter a Code**. No generic teacher dashboard.

### 5. Students = the same
`/school/students` becomes **Students in This School**: one card per student with name, Student ID and **Open Workspace**. Empty state offers Find a Student / Enter a Code.

### 6. That person's school workspace, view only
`/school/teachers/<id>` and `/school/students/<id>` open that individual's school-context workspace: the rotating building plus their school work — for a teacher, their classes, lesson notes, activities, assignments, adventures and reports within this school; for a student, their classes, assignments, adventures, Smartboard work and progress.

Every one of these pages is observation:
- a persistent banner "Viewing <name>'s school workspace — view only";
- no authoring, submitting, editing or building controls rendered at all (removed, not merely disabled);
- read paths are school-scoped in SQL, so the administrator can only ever see work inside their own school.

This is not impersonation — the administrator stays signed in as the school.

### 7. School report keeps its shape
Existing school report visualisation stays, with its purpose stated: the combined academic record of the school's teachers and students. Drill-down School → Teachers → their classes → unique school students → individual. Unique students counted once, however many classes they are in.

### 8. Membership rule stays enforced
A class owned by a school-context teacher only admits students who belong to that school; a class code alone is not enough. (Already the agreed rule — this plan does not loosen it.)

## Technical notes

- New SQL, additive only: `school_teachers(_org_id)` returning each accepted teacher's user id, display name and MathGPL ID; `school_member_overview(_org_id, _user_id)` returning the read-only summary (classes, notes, activities, assignments, adventures, progress) for one member. Both `security definer`, both asserting `is_org_owner(_org_id)` first, so nothing leaks across schools. Reuse `workspace_students` for the student list.
- New routes `src/routes/school/students/index.tsx`, `src/routes/school/teachers/$userId.tsx`, `src/routes/school/students/$userId.tsx`, each with its own `head()` and `noindex`.
- New `SchoolCommandNav` (large cards) used by the school pages; `RoleShell`'s pill nav stays for other roles.
- A `viewOnly` context flag wraps the observed workspace so shared teacher/student panels render without their action controls.
- `ShareCodeCard` gains no logic of its own — `MyAccountPage` simply omits it when the account is a school.
- Building settings stay school-owner-only; the observed workspace never shows them.

## Verification

Sign in as the school: My Account shows one code only; Teachers shows the empty-state with Find a Teacher, not a form; connect a teacher via code, then confirm they appear as a card and Open Workspace shows that teacher's own classes with the view-only banner and no edit controls; repeat for a student; confirm Go Live and discovery behave exactly as before.
