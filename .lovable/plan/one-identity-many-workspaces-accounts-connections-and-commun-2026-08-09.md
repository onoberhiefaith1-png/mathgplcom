# One identity, many workspaces — accounts, connections and Community of Practice

MathGPL already has permanent MathGPL IDs, workspaces (`organizations` + `account_memberships`), role navigation, the rotating building, and the branded email system. This plan keeps all of that and rebuilds the *relationship* layer on top of it: school-independent IDs, a universal Share Code, a single request/accept system for every relationship, per-school teacher workspaces, and a Community of Practice with Schools / Teachers / Students.

Verified starting point: teacher, student and parent IDs are already school-independent (`TCH/000001`, `STU/000001`, `PAR/000001`). Only the school ID embeds an acronym today (`SC/MS/000001`). There is no share-code table and no general request table — teacher joining is email-invitation only, and there is nothing for school↔student, teacher↔student or parent connections.

## Phase 1 — Identity corrections

- School IDs become `SC/000001`. New IDs are issued without the acronym; the one existing `SC/MS/000001` is renumbered in the same migration (the immutability trigger is lifted only for that one-off correction, then restored). Teacher/student/parent IDs are untouched.
- Every account gets a permanent, regenerable **Share Code** (short, unambiguous, e.g. `ABC123XYZ`). It identifies an account for a connection request and can never sign anyone in.
- Teachers get a **Go Live** switch. Off by default: a teacher who is not live never appears in Community discovery. Live changes discovery only — never email, credentials or private data.
- Login stays MathGPL ID + password. No Google button. Emails keep their current design and continue to carry the person's ID.

## Phase 2 — One connection system

A single `connections` table replaces the scattered link tables for new relationships, with one row per relationship and a request lifecycle: `pending → accepted / rejected / revoked`.

Supported pairs, each initiable from either side:

```text
school  <-> teacher      school <-> student
teacher <-> student       parent <-> child (student)
parent  <-> teacher       parent <-> school
```

Two ways to start a request, and only these two:

1. Enter the other account's Share Code.
2. Find the account in Community of Practice.

A relationship only becomes real once the receiving side accepts. Accepting a school↔teacher request is what creates that teacher's workspace membership for that school. Existing accepted relationships (current memberships, class members, parent links) are carried over as accepted connections so nothing already working disappears.

A **Requests** area is added to every role: Incoming, Outgoing, Accepted, Rejected, with Accept / Reject / View profile. Each incoming request also sends the existing branded notification email.

## Phase 3 — Workspaces and dashboards

- **Workspace switcher**: Personal workspace first, then one entry per accepted school. Switching changes context only; nothing moves. The active workspace and "viewing as" state are always visible.
- **Teacher dashboard**: name, `TCH/000001`, live school count, count of *directly connected* students, then the list of school workspaces. School students never leak into "My Students".
- **School dashboard**: name, `SC/000001`, real counts of teachers, students, activities and pending requests — read from the database, no placeholder numbers. Navigation is administrative: Administration, Teachers, Students, Account, Security, Community, Requests, Settings. **No Teaching Hub.**
- **Student / Parent**: My Schools, My Teachers (parent also My Children), plus Community, Requests, Account, Security, Settings.
- **Entering another workspace**: school → teacher, school → student, teacher → connected student, parent → child. A banner states whose workspace it is and as whom it is being viewed, with **Exit workspace**. The visitor never becomes that person; a teacher can never open another teacher's workspace.
- Isolation: classes, students, assignments, reports and settings stay scoped to the school workspace they belong to.
- Building-first is preserved: login → building → workspace, using the existing rotating building.

## Phase 4 — Community of Practice

Three top-level categories: **Schools**, **Teachers**, **Students**.

- Ranked by real activity signals (recent activity, published resources, engagement), not alphabetically — with search always available.
- Teachers appear only while Go Live is on. Schools appear when discoverable. Students are protected: a student is only listed with explicit opt-in, and their card shows no sensitive detail.
- Every profile card carries the appropriate action: Invite teacher, Request to join school, Request to connect. All of them create a Phase 2 request.
- The existing Community resource library (copy to my workspace, request access to classes) stays exactly as it is.

## Technical notes

- Migrations are additive apart from the one-off school-ID renumbering. Tables: `share_codes` (or a share-code column on `account_ids`), `connections` (subject/object account, relation type, status, initiator, timestamps, uniqueness per pair+type), `teacher_visibility` for Go Live, and an activity-signal view for Community ranking. Every new public table gets GRANTs, RLS and policies in the same migration.
- Authorisation goes through `SECURITY DEFINER` helpers in the shape of the existing ones (`owns_org`, `is_workspace_member`, `has_role`): `is_connected(a, b, type)`, `can_enter_workspace(target_user)`, `resolve_share_code(code)` — the last returns only a display name, account type and ID, never an email.
- Server-side work uses `createServerFn` with `requireSupabaseAuth`; share-code resolution and request creation are rate-limited and never reveal whether an unknown code exists.
- Existing tables stay: `account_memberships` remains the membership record, `teacher_invitations` keeps working for email invitations, `parent_teacher_links` and class membership are read alongside connections during transition.
- Untouched: auth, transactional/Gmail email system and templates, rotating building and homepage customisation, Teaching Hub, lesson notes, classes, adventures, smart cards, administrator console.

## Delivery order

Phase 1 → Phase 2 → Phase 3 → Phase 4, each ending in a working app. Because this is a large refactor, I will implement it phase by phase and check in after each so you can verify with real accounts before the next one starts.
