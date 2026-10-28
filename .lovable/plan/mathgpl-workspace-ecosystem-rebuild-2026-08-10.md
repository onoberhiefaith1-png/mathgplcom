# MathGPL — Workspace Ecosystem Rebuild

Reorganise the existing platform into three consistent workspace shells (School, Teacher, Student) matching the approved designs: left navigation, centre dashboard with the building hero, right-hand context panel. No existing feature is removed; pages are re-hosted inside the new shells.

## What is already in place (verified)

- One identity, many workspaces: `account_memberships` + `profiles.active_org_id` + `my_workspaces()`, with a working `WorkspaceSwitcher`.
- Workspace scoping helper (`activeSchoolOrgId` / `withWorkspaceScope`) and `notebooks.org_id`; `classes.org_id` is stamped by trigger, so assignments, adventures and progress inherit their school through their class.
- Go Live and Accept Requests already exist as two separate controls with the "what Go Live means" confirmation dialog.
- Connections, share codes, requests, Community discovery, buildings/backgrounds, Teaching Hub, student features.

Not in place: profile images (no avatar column), the left-nav/right-panel workspace shells, real dashboard statistics, and confirmed workspace filtering on every student-side surface.

## Phase 1 — One workspace shell

New `WorkspaceLayout` component: fixed left nav (brand, profile block with name/role/MathGPL ID, sectioned links, Go Live control at the bottom), top bar (workspace title, search, notifications/requests count, account menu), centre content, right context rail. On tablet the right rail becomes a collapsible drawer; on phones the left nav becomes the existing bottom/rail student nav and the rail stacks under the dashboard. Existing route content is placed inside it — nothing is rewritten.

## Phase 2 — Three dashboards

- **Teacher** (`/teaching-hub`): building hero greeting, stat cards (Schools connected, Students, Classes active, Assignments), upcoming schedule, recent activity, quick actions. Right rail: My Schools (each opens that school context), Manage Connections, My Students overview.
- **School** (`/school`): administrative command centre — stat cards (Teachers, Students, Classes, Pending requests), Accounts overview, quick actions, recent activity. Right rail: Teachers, Students, Activities, Requests, Community. No Teaching Hub anywhere in school navigation.
- **Student** (`/student`): learning dashboard — building hero, stat cards (Assignments, Adventures, Assessments, Progress), today's schedule, recent activity, quick actions. Right rail: My Schools, My Teachers, My Progress, My Achievements (structure only until backed).

Every number comes from a database query. Anything without backend support renders as a labelled empty/"Coming soon" state — never invented figures.

## Phase 3 — Workspace isolation audit

Faith's School A data must never appear in School B. For each student and teacher surface (assignments, adventures, assessments, progress, class notes, reports), confirm the query is filtered by the active workspace through `classes.org_id`, and add the filter where it is missing. Add SQL helper functions for the dashboard counts so authorisation is enforced server-side, not by hiding buttons.

## Phase 4 — Viewing another workspace

School → Teachers/Students → a person → their workspace opens read-only inside the same shell, with a persistent banner "Viewing Faith's workspace as Cognitive Academy" and an **Exit workspace** button. Read-only is enforced by the existing view-only flag plus policies, not just hidden controls.

## Phase 5 — Profile images

Additive migration: `profiles.avatar_url` and a public `avatars` storage bucket with owner-write / public-read policies. Upload/change control in Profile & Settings; the image is reused in the left nav, rosters, directories and Community listings. Default MathGPL avatar when none is set.

## Phase 6 — Community + Go Live wiring

Community categories: Schools, Teachers, Students, Assets (keeping existing sections). Listings come only from Live accounts, ranked by the existing activity score plus real engagement signals, with search always available. Turning Go Live off removes the account from listings.

## Technical notes

- New: `src/components/workspace/WorkspaceLayout.tsx`, `WorkspaceRail.tsx`, `WorkspaceNav.tsx`, per-role dashboard pages, `src/lib/workspace/stats.ts` for count queries.
- Reuse `useWorkspace`, `activeSchoolOrgId`, `RotatingAdventureScene` (keeps the existing looping video background — no static substitute), `GoLiveToggle`, `MathgplIdCard`.
- Only additive migrations: `profiles.avatar_url`, the avatars bucket, and read-only stat/roster SQL functions with GRANTs.
- Existing routes keep their URLs; shells wrap them.

## Suggested delivery

Phases 1–2 first (shells + three dashboards on real data), then 3–4 (isolation + observed workspaces), then 5–6.
