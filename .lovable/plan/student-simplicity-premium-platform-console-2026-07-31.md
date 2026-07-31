# Student Simplicity + Premium Platform Console

Two parts: make the Student account a pure "join a class and learn" experience, and rebuild the Platform dashboard as a premium SaaS control centre with true Enter Workspace access. No existing permissions, tables or account relationships change.

## Part 1 — Student account

**Homepage (rotating building)**
- For signed-in students, the Teaching Hub button is replaced by a **Join Class** button (same fixed position/styling language, graduation-cap icon, links to `/join`). Teachers, schools, parents and visitors keep Teaching Hub exactly as today.

**Join Class page (`/join`, `/join/:code`)**
- Keeps the existing Join Code + Invite Link + Request flow (already the only surface on this page for students).
- Explicitly hides any teacher affordance for students: no Create Class, no Quick Class, no "previously joined by code" teacher hints — for students the panel shows only: Join Code field, Invite Link field, Request button, pending-request banner, pending invitations, and their MathGPL ID.
- Approval flow is unchanged: request → teacher approves → student is auto-navigated into `/student/class/:id`.

**Student dashboard (`/student/classes`, `/student/class/:id`)**
- `/student/classes` stays the student front door (My Classes + Join panel), restyled with the new premium card language.
- Inside a class, the student sees exactly six tiles plus Settings: Lesson Notes, Smartboard, Assessment, Adventure, Gallery, My Reports. No create/edit/delete controls anywhere in the student tree.

**Permissions**
- Student capabilities stay read + complete: view notes, open smartboard, complete assessments, play adventures, view gallery, submit work, view own reports.
- Any create action reachable from student routes is removed from the UI; server/RLS rules already deny creation, so this is a presentation-level tightening only.

**Student reports**
- `/student/report` shows only the signed-in student's own data: Overall Progress, Assignments, Assessments, Adventure Progress, Attendance, Scores, Achievements. Classmate data is never queried.

## Part 2 — Premium account dashboard (Platform, then School/Parent)

**Shared dashboard shell**
- New `DashboardShell` (premium navy gradient canvas, light elevated cards, soft gold accents, rounded corners, generous spacing, subtle borders) that replaces the flat dark `RoleShell` chrome for `/admin`, `/school` and `/family`, keeping the same role-driven navigation data.
- **Change Background** control: a small picker (a few curated premium gradients/images from existing assets) stored per account in local preference + `profiles`-level setting where available. Cards keep an opaque surface so text contrast is never reduced.

**Stat cards**
- Each metric (Schools, Teachers, Parents, Students, Active subscriptions, Expired/suspended, New in 30 days) becomes its own coloured card with icon, title, large number, hover lift and click feedback — same identity idea as Teaching Hub tiles. Numbers come from the existing `fetchPlatformStats`.

**Account tables**
- Existing tabs and columns are preserved. Each row gains an action group: **Preview**, **Edit**, **Enter Workspace**.
- **Preview** opens a side sheet with the account's profile, organisation, subscription/status, membership counts and joined date — read from the data already returned today (no workspace content).
- **Edit / lifecycle**: rename/display-name edit plus Suspend, Reactivate, Delete, and Add account, implemented through new platform-admin server functions that verify platform-owner/co-admin first.

**Enter Workspace (platform owner + co-admin only)**
- Clicking Enter Workspace calls a new protected server function that (1) verifies the caller is platform owner/co-admin, (2) uses the privileged admin client to mint a one-time sign-in link for the target account, and returns a short-lived token.
- The client stores the owner's own session, exchanges the token for the target's session, and navigates to that role's home (`/school`, `/teaching-hub`, `/family`, `/student/classes`). The workspace then behaves exactly as the real user's — same RLS, same data, same UI.
- A persistent top banner shows "Viewing <name> as <role> — Exit workspace"; Exit restores the stored owner session and returns to `/admin`.
- Every entry is written to an audit row so impersonation is always traceable.

## Technical notes

- Files touched: `src/pages/Index.tsx` (role-aware Join Class button), `src/components/class/JoinClassPanel.tsx` (student-only view), `src/pages/accounts/StudentClassesPage.tsx` and `src/pages/student/*` (tile set, no-create), `src/pages/student/StudentReportPage.tsx` (own-data only), new `src/components/accounts/DashboardShell.tsx` + `StatCard.tsx` + `BackgroundPicker.tsx`, `src/pages/accounts/AdminConsole.tsx` / `SchoolDashboard.tsx` / `FamilyDashboard.tsx`, new `src/components/accounts/AccountPreviewSheet.tsx` and `ImpersonationBanner.tsx`.
- Server: extend `src/lib/accounts/platform.functions.ts` + `platformAdmin.server.ts` with `enterWorkspace`, `updateAccountStatus`, `deleteAccount`, `createAccount`; all guarded by `assertPlatformAdmin`.
- Database: additive only — one `admin_impersonation_log` table (with GRANTs and platform-admin-only RLS) and, if needed, a `dashboard_background` preference column on `profiles`.
- Existing logic, roles, capabilities and RLS policies are left intact.
