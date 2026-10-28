# Account System Foundation (Phase 1)

Build the multi-tenant role foundation: who each account is, who owns them, what they may do, and where they land after signing in. No existing feature page (Lesson Notes, SmartBoard, Games, Adventure, MathGPL Live) changes behaviour in this phase.

## What this phase delivers

1. **Five roles**: `platform_owner`, `co_admin`, `school`, `teacher`, `parent`, `student`.
2. **Ownership tenancy** — every account belongs to exactly one owner (platform, a school, a teacher, or a parent). Lists are always scoped to the owner; users from different owners are never merged.
3. **Permission engine** — capabilities are data, not `if (role === 'teacher')` checks scattered through pages. New roles later (Tutor, Head of Department) get a capability row, not a rewrite.
4. **Role-based navigation and home routing** — one app, four front doors.
5. **Signup role selection** — new accounts choose School / Teacher / Parent / Student. Everyone who already exists becomes a Teacher, so nothing they own is lost.

## Ownership model

```text
Platform Owner
├── Co-Administrators
├── Schools            → own their Teachers, Students
├── Independent Teachers → own their Students
├── Independent Parents  → own their Children (student accounts they create)
└── Independent Students
```

A school's teachers never appear in the platform Teacher list. A teacher's students never appear in the platform Student list. This is enforced in the database, not just in the UI.

## Where each role lands after sign-in

| Role | Home | Navigation |
| --- | --- | --- |
| Platform Owner / Co-Admin | `/admin` console shell (accounts tabs, usage, subscriptions — surfaces stubbed this phase) | Admin only |
| School | `/school` dashboard | Teaching Hub, Teachers, Students, Classes, Reports, Accounts, Billing, Settings |
| Teacher | `/teaching-hub` (unchanged) | Today's hub tiles |
| Parent | `/family` dashboard | Children, Teaching Hub, Reports, Gallery, Settings |
| Student | `/student/classes` — straight to My Classes, no hub | Classes only |

Menu items a role cannot use are not rendered at all (never shown disabled).

## Parent → child accounts

A parent creates the child's student account directly from the Children page. The child account is owned by the parent, gets its own login, and is auto-linked as that parent's child. Linking an existing student by MathGPL ID is deliberately left for a later phase.

## Technical notes

**Migration (additive only, no existing table or column is modified):**
- `app_role` enum and `user_roles` table (roles are never stored on `profiles`), with `has_role(uuid, app_role)` security-definer helper.
- `organizations` — one row per School / independent Teacher / independent Parent tenant; `kind`, `name`, `owner_user_id`, `parent_org_id`.
- `account_memberships` — links a user to the organization that owns them, with `role` and `status` (active / suspended).
- `parent_children` — parent user ↔ student user.
- `role_capabilities` — `(role, capability, scope)` rows seeded from the permission matrix in the brief (create_class, join_class, create_lesson_notes, view_lesson_notes, ai_generation, manage_teachers, manage_students, billing, reports, smartboard).
- Security-definer helpers `current_org_id()`, `owns_user(uuid)`, `has_capability(text)` so RLS never recurses.
- Every new table: GRANTs, RLS on, owner-scoped policies. Existing tables are untouched this phase.
- Backfill: every current `auth.users` row gets `teacher` plus its own `organizations` row of kind `teacher`.

**App code:**
- `src/lib/accounts/roles.ts` — role/capability types and the client-side capability check.
- `src/lib/accounts/useAccount.ts` — one hook returning `{ role, orgId, capabilities, can(cap) }`, cached with TanStack Query.
- `src/components/accounts/RequireCapability.tsx` — wraps role-restricted UI.
- New route shells: `/admin`, `/school`, `/family`, `/student/classes`, plus a `/home` dispatcher that redirects to the correct home for the signed-in role.
- `src/pages/Auth.tsx` gains a role picker on the signup tab; post-login redirect goes through the dispatcher instead of the hard-coded `/lesson-notes`.
- The Platform Owner role is created but granted to no one yet; you tell me the email and I grant it in a one-line follow-up migration.

## Out of scope for this phase

Accounts management CRUD screens (add/invite/suspend), bulk student import, billing and subscriptions, AI quotas, impersonation and audit logging, analytics, attendance, and parent–teacher messaging. Each becomes its own phase on top of this foundation.
