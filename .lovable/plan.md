# School Workspace, membership and Go Live

Big change, so it lands in four phases. **Phase 1 (Go Live / discovery) is what gets built on approval** — you asked for the request workflow to stay untouched for now. Phases 2–4 are written down so the data model isn't painted into a corner.

## What already exists (checked)

- Accounts already carry a Live switch and an "accept requests" switch, both enforced in the database.
- Community discovery already lists Schools, Teachers, Students and Parents, ranked by activity, searchable by name or MathGPL ID, and only ever shows Live accounts.
- Requests, accept/reject and connections already exist end to end.
- Schools already have a unique invite code column; it is not yet surfaced anywhere in the School pages.
- School navigation already has no Teaching Hub.
- Students today can join a class whenever the school's workspace is public — school membership is **not** required.
- The School Teachers page still contains First name / Last name / Teacher email / Send invitation, i.e. it still looks like the school creates the teacher account.
- Teachers and students still have their own Building/Background settings; there is no school broadcast.

## Phase 1 — Go Live becomes a real discovery layer

One shared Go Live panel, used by School, Teacher, Student and Parent accounts:

- A single unmistakable control: red **OFF — Go Live** / green **LIVE — You are Live**, with the sentence "Your profile is now discoverable by schools, teachers and students through Community. Going Live does not automatically connect you to anyone."
- Turning it off removes the account from Community search immediately, in the same visit.
- "Accept requests" stays a separate switch next to it, with the four honest states already in place.
- The panel shows the account's permanent identity: MathGPL ID, and for a school also its **School Code**, with copy and regenerate.

Two connection routes are made explicit (discovery only — the request itself keeps today's behaviour):

- **Search**: Community → Schools / Teachers / Students / Parents → find → the request button appears only when that account accepts requests.
- **Code**: a teacher enters a School Code; a school enters a Teacher ID or Student ID. The code is verified against a real account before anything is created, and the account name is shown for confirmation.

Nothing about Go Live grants access: it never joins a school, never joins a class, never reveals a workspace.

## Phase 2 — Membership: students belong to the school

- A student's school membership becomes the gate for joining any class: a class code alone stops working. Joining checks that the student is an accepted member of the school that owns the class, and otherwise says "You must join this school before you can join this class."
- Classes stay owned by teacher **and** school, so cross-school data never mixes.
- The School Teachers page loses the account-creation form. It becomes **Add teacher → Search (Live teachers) or Enter Teacher ID**, which sends a membership request to that existing teacher account. One teacher account, many schools, never duplicated.
- Students are added the same way (search or Student ID); the school never creates student accounts.
- Requests split into **Teacher requests** and **Student requests** with Pending / Accepted / Rejected.
- Every count of students is a count of unique student accounts, never class enrolments: a student in five of a teacher's classes is 5 classes, 1 student.

## Phase 3 — The School Administrator workspace

- Account menu says **School Account**, grouped: TEACHER (Teachers, Teacher requests) · STUDENT (Students, Student requests) · SCHOOL (Reports, Building, Settings, My account, Sign out). Still no Teaching Hub, no authoring tools.
- **Teachers**: one card per teacher — name, avatar, classes, unique students, overall progress, status, **View workspace**.
- **Students**: one card per student — name, classes, teachers, overall progress, assignments, adventures, **View workspace**.
- **View workspace** opens the real teacher or student environment with a persistent banner "Viewing <name>'s workspace — View only", and every authoring, submitting and editing control removed rather than merely hidden.
- **Reports** drill down School → Teacher → Class → Student → individual report: school totals (unique students, teachers, classes, assignments, adventures, expected vs achieved, overall progress), then per teacher, per class, per student.
- The rotating building stays the centre of the School Workspace, ringed with administrative cards: Teachers, Students, Classes, School progress, Reports, Requests.

## Phase 4 — The school owns the building

- Building settings appear only for the School Administrator inside a school workspace.
- Saving them makes that building and that background official for every teacher and student of the school; they inherit it and have no settings control of their own.
- Backgrounds keep the existing looping-video behaviour — a school video stays a video everywhere it appears, never a still frame.
- A teacher who belongs to no school keeps their own building.

## Technical notes

- Phase 1 is UI plus a small amount of SQL: expose `organizations.invite_code` through a school-owner RPC with regenerate, and add lookup-by-code RPCs that resolve a School Code / Teacher ID / Student ID to a display name without leaking anything else. Discovery functions already return `is_live` and `accepts_requests`.
- Phase 2's gate replaces `class_join_gate`'s "public workspace" test with accepted `account_memberships` for `classes.org_id`, plus matching RLS on class joining so the rule holds even outside the UI. Unique-student counts move into SQL (`count(distinct user_id)`).
- Phase 3's view-only mode extends the existing workspace `viewOnly` flag to teacher and student workspaces entered by a school owner, with server-side read policies scoped to the school; reports are new SQL aggregates plus pages under `/school`.
- Phase 4 resolves the homepage config as: school override (when the account belongs to a school) → account custom → platform default, and hides the settings entry for non-owners.

## Verification

Phase 1: sign in as each role, go Live and confirm the account appears in the matching Community category; turn it off and confirm it disappears; confirm going Live alone gives no access to any workspace or class; enter a School Code as a teacher and a Teacher ID as a school and confirm both resolve to the right named account.
