# One Ecosystem: Identity → Workspace → Membership → Permissions

This is a connection job, not a rebuild. Nothing existing is replaced: roles, organisations, memberships, classes, lesson notes, SmartBoard, Adventures, Courses, Community and all teaching features stay exactly as they are. What gets added is the missing layer that says *which workspace a person is currently operating in* — and makes every list, building, permission and Community view answer to it.

## What the app already has (verified)

- One identity per person, roles in `user_roles`, tenants in `organizations` (platform / school / teacher / parent).
- `account_memberships` is already unique on `(user_id, org_id)` — one person can already belong to many organisations. Nothing new is needed to allow multi-school teachers.
- `teacher_invitations` (pending / accepted / revoked) and `parent_teacher_links` already exist, so invitation-based relationships are already the pattern.
- Class join already requires teacher approval: a code creates a row in `class_join_requests`, and only the teacher's approval inserts into `class_members`.
- Community already exists as a read-only mirror of the same workspace (`CommunityModeProvider`), with `community_resources` and `community_profiles`.

## What is missing (the real gaps)

1. **No active workspace.** `org_of()` / `current_org_id()` return the *first* membership row. A teacher in three schools has no way to say "I am in School A right now".
2. **Classes and content are not workspace-scoped.** `classes` has an `owner_id` but no organisation, so a personal class and a School A class are indistinguishable.
3. **No student roster per teacher or per school.** Students only exist inside classes, so "select from School A's students" and "select from my personal students" cannot be expressed.
4. **No discoverability flag.** Nothing marks a teacher or school public/private, so Community discovery and private-invite codes have nothing to read.
5. **Community is not context-aware.** It behaves identically no matter which workspace you entered it from.
6. **No school view-only entry** into a teacher's workspace (only the platform owner's impersonation exists).

## The model to add

```text
        ONE IDENTITY (auth user + role)
                    │
        active workspace = one authorised membership
                    │
   ┌────────────────┼────────────────┐
Personal          School A        School B
workspace         workspace       workspace
   │                 │                │
personal          school          school
students          students        students
   │                 │                │
classes           classes         classes  →  learning data stays with its workspace
```

Rules enforced in the database, not just the UI: a class belongs to exactly one workspace; a class roster may only contain students of that workspace; workspace switching changes context and never creates an account.

## Delivery in four phases

Each phase ships working, so nothing is half-connected.

**Phase 1 — Workspace as a first-class concept**
- Every account gets a personal workspace membership plus one membership row per school it belongs to (backfilled from existing data; no new accounts).
- A stored active workspace per user, with `current_org_id()` reading it instead of "first row".
- A Workspace Switcher in the header: Personal / School A / School B, and for students: My MathGPL / Schools / Teachers. Switching changes the building, navigation and data — no re-login.
- The rotating building resolves from the active workspace's owner, so entering School A shows School A's building.

**Phase 2 — Two student populations, never merged**
- A membership-based roster: students belong to a school workspace, or to an independent teacher's personal workspace, established only by acceptance (invite or approved request).
- Classes gain a workspace. Student pickers inside a class only offer that workspace's students; personal students can never be pulled into a school class.
- Join Code hardening: the code identifies the class, the authorised relationship grants entry. A code holder with no relationship to the teacher/school gets "Ask your teacher to add you" instead of access.

**Phase 3 — Roles by workspace, and school supervision**
- Teaching Hub is shown for teacher context only. School and Parent workspaces keep administration, supervision and reports and lose the authoring entry points. Platform admin keeps platform administration plus Community, without teacher authoring tools.
- A teacher inside a school keeps Teaching Hub but gains no school administration.
- School → Teachers → Open workspace enters that teacher's classes, notes, adventures, courses and reports in explicit **View only** mode: nothing is editable and no creation controls render.

**Phase 4 — Community: discoverability and context**
- Public/private is discoverability only. Private accounts keep full Community access; they just don't appear in public search. A private teacher can still be reached by a controlled invite code, and still must Accept or Decline.
- School → Add Teacher searches public teachers in Community and sends an invitation; the teacher sees "X has invited you to join their school" with Accept / Decline. Codes and searches never auto-create membership.
- Community actions become workspace-aware: personal teacher gets relationships plus resources; teacher-inside-school gets resource discovery only; school gets administrative discovery and invitations; student gets learner discovery.
- Copying a resource copies content only — never students, classes, scores, reports or relationships. MathGPL Academy becomes the default resource surface. No separate Templates system.

Progress and history: each workspace keeps its own records; the student's personal environment adds a cumulative view computed from those records, never overwriting them.

## Technical notes

Additive migrations only; existing tables are extended, not replaced.

- `organizations.visibility` (`public` | `private`) and an invite/join code for private orgs; the same flag on the teacher's personal organisation.
- `profiles.active_org_id` (or a small `user_workspace_state` row) + rewritten `current_org_id()`; `org_of()` kept for compatibility.
- `classes.org_id` (nullable during backfill, then set from owner's personal org) plus a trigger/policy ensuring `class_members` only accepts users with an active membership in that class's org.
- Roster reads through new security-definer helpers `workspace_students(_org_id)`, `is_workspace_member(_org_id)`, `can_view_workspace(_org_id)` so RLS never recurses; school view-only is a read-only clause added to `classes`, `notebooks`, reports — no write policies widened.
- Frontend: a `WorkspaceProvider` (active org, kind, capabilities, viewOnly) that `useAccount`, `ROLE_NAV`, `WorkspaceShell`, the rotating building and Community all read; `roles.ts` navigation becomes a function of role + workspace kind instead of role alone.
- Verification pass over the 15 listed scenarios (both teacher-in-school cases, student in school vs independent teacher, join-code rejection, invitation accept/decline, view-only school access, Community per workspace).

## Question before building

Phase 1 alone is a large change to navigation and data scoping. Confirm you want all four phases sequenced now, or Phase 1 first so you can test workspace switching before the roster split lands.
