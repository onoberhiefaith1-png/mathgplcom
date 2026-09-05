## Technical notes

**Storage (additive, applies when this draft is accepted)**
- `account_ids.custom_id text` — nullable, unique on `lower(custom_id)`, plus `custom_id_updated_at`. The permanent `mathgpl_id`, `seq` and `prefix` stay untouched, so the existing `account_ids_immutable` trigger keeps guarding them; the trigger is extended to allow `custom_id` changes only.
- `profiles.managed_by_org_id uuid` (nullable, references `organizations`) and `profiles.managed_by_user_id uuid` — marks a school/teacher-created student. Non-null means single-workspace mode.
- `account_ids.custom_id_history jsonb` default `[]` for an audit trail of previous chosen IDs (previous IDs are not reusable by others).

**Sign-in**
- `signInWithMathgplId` in `src/lib/accounts/accountId.functions.ts`: resolve `custom_id` first (case-insensitive), then fall back to `mathgpl_id`. `ID_PATTERN` in `accountIdRules.ts` gains a free-form branch; identical generic failure messages and the existing throttle are kept so IDs cannot be enumerated.
- Managed students authenticate against a synthetic internal address (`<uuid>@managed.mathgpl.local`, confirmed, never shown or emailed to), created through the Auth Admin API — the browser only ever sees ID + password.

**New server functions** (`requireSupabaseAuth`, admin client loaded inside handlers)
- `checkAccountIdAvailable` — reserved-word list, format check, both-column uniqueness.
- `changeMyAccountId` — own account only; writes `custom_id`, appends history, enqueues an `account-id-changed` email via `accountEmails.server`.
- `createManagedStudent` / `resetManagedStudentPassword` / `setManagedStudentStatus` / `removeManagedStudent` in a new `src/lib/accounts/students.functions.ts`, backed by `students.server.ts` next to `teamAdmin.server.ts`. Every one re-derives the caller's owned org via `requireOwnedOrg` (school) or teacher ownership, so a caller can only touch their own students. Creation is rollback-safe: on any later failure the auth user is deleted.
- Student creation writes: auth user → `user_roles` student → `account_memberships(org, student, active)` → `account_ids` with `custom_id` → `profiles` with `active_org_id` and `managed_by_org_id`.

**Single-workspace lock**
- `useWorkspace`/`workspaceScope` treat a non-null `managed_by_org_id` as a fixed scope: workspace switcher hidden, Community entry hidden, `active_org_id` pinned. Server side, the join/switch server functions reject a managed student, so the lock is not just UI.

**UI**
- `src/components/accounts/ChangeAccountIdPanel.tsx` — mounted in the existing account settings screen next to password change, available to every role.
- `src/pages/school/SchoolPeoplePage.tsx` and `src/pages/teacher/TeacherStudentsPage.tsx` — "Create student account" dialog (name, ID with live availability, password twice), plus per-student reset / suspend / remove and a printable credential slip.
- Zod validation shared between form and server through a new `studentRules.ts`, mirroring the `accountIdRules.ts` pattern.

**Tests**
- ID normalisation and format acceptance/refusal, availability collision against both columns, resolver preferring `custom_id`, managed-student scope lock.
