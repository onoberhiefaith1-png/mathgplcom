# Rebuild the Teacher Workspace

Scope: the Teacher Workspace only. School, Student, Parent and Administrator workspaces, authentication, email, Teaching Hub tools, Adventure, Smartboard, Community and the building system stay as they are — they are re-hosted, not rewritten.

## One note on the navigation side

In the approved design the main navigation panel sits on the **left** (Dashboard, Teaching Hub, My Connections, Account, Go Live at the bottom) and a **right-hand context panel** carries My Schools, Manage Connections and My Students Overview. The rebuild follows the image exactly: left navigation panel + right context panel. Both are always reachable, so navigation between workspace areas stays one click away.

## What already exists (verified)

- Three-panel shell `WorkspaceLayout` with role-aware navigation, workspace switcher, requests bell, avatar, and a view-only banner.
- Teacher dashboard at `/teaching-hub` with real workspace-scoped counts (schools, students, classes, assignments) and recent lesson-note activity.
- Go Live with its explanation-and-confirm dialog and a separate "Accept requests" switch; private Share Code is separate.
- Requests page with incoming / outgoing / accepted / rejected tabs on real connection data.
- One teacher identity across many school workspaces (`account_memberships` + `active_org_id`), with school data kept apart.
- Read-only member workspace viewing exists for schools (`/school/teachers/$userId`, `/school/students/$userId`).

Missing against the design: the premium MathGPL look (gold/purple, dark fantasy panels), the teacher name and Teacher ID in the header, the looping building video in the hero, a teacher route into a student's workspace, and the visible "what am I viewing" indicator.

## Work

**1. Workspace chrome to match the design**
Restyle `WorkspaceLayout` into the approved premium dark shell: crest + MATHGPL wordmark, profile block with avatar, teacher name, role and Teacher ID badge, sectioned nav groups (Teaching Hub / My Connections / Account), search field, notification and message bells with real counts, account menu showing name + Teacher ID, and the Go Live control pinned at the bottom of the nav. Rounded panels, gold and violet accents, clear icons, strong hierarchy — no generic SaaS surface. Go Live keeps its existing confirmation flow and its own "Accept connection requests" switch (default ON).

**2. Teacher dashboard**
Hero band with the teacher's own building background — the looping video when their configuration is a video, never falling back to the static image — plus the greeting and a link back to the building. Below it: the four stat cards (Schools Connected, Students Teaching, Classes Active, Assignments), Upcoming Schedule, Recent Activity and Quick Actions. Right panel: My Schools (each with school ID, counts, "Enter School Workspace"), Manage Connections, My Students Overview.

Every figure comes from the database. Upcoming Schedule and Messages have no backend behind them, so they render as prepared panels labelled **Pending** rather than invented rows. Empty states read "No connected schools yet — Connect a School", never filler numbers.

**3. My Schools and My Students**
My Schools lists the teacher's real memberships; selecting one enters that school context and keeps its data separate. My Students lists students connected to this teacher through the actual relationship, not every student of every school.

**4. Viewing a student's workspace as the teacher**
New route `/teaching-hub/students/$userId` following the existing school-member pattern: opens the student's workspace read-only inside the same shell, with the banner "Viewing [Student Name]'s Workspace — As Teacher" and an **Exit workspace** control. Read-only remains enforced by the existing view-only flag and policies.

**5. Current-workspace indicator**
A persistent strip in the header stating who you are (name + Teacher ID) and which workspace you are in (Teacher Workspace, a connected school, or someone else's workspace being viewed). The same indicator covers a school administrator opening a teacher's workspace: "Viewing [Teacher Name]'s Workspace — As School".

**6. Responsive**
Left nav becomes a drawer on tablet and phone; the right panel stacks under the dashboard. The hero keeps the building composition coherent instead of cropping into it, and every control keeps a 44px touch target.

## Technical notes

- Edit: `src/components/workspace/WorkspaceLayout.tsx`, `workspaceNav.ts`, `DashboardHero.tsx`, `DashboardParts.tsx`, `src/pages/accounts/TeacherDashboard.tsx`.
- Add: teacher-side student workspace route + page (mirroring `SchoolMemberWorkspacePage`), and a workspace-context indicator component.
- Reuse `useWorkspace`, `useTeacherStats`, `GoLiveToggle`, `ShareCodeCard`, `AccountAvatar`, `useHomepageConfig`.
- Design tokens for the gold/violet premium theme go into `src/styles.css`; no hardcoded colour utilities in components.
- No migrations required; teacher-student listing uses the existing connection functions.
