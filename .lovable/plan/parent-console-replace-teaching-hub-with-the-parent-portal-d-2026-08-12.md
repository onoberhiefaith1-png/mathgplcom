# Parent Console: replace Teaching Hub with the parent portal design

The parent workspace stops borrowing teacher language. "Teaching Hub" disappears from every parent surface and becomes **Parent Console**, and `/family` is rebuilt to follow the uploaded Parent Portal design.

## 1. Rename and re-route

- Homepage (rotating building): for a parent account the amber button reads **Parent Console** and opens `/family`. School keeps School Console; teacher keeps Teaching Hub. No other role changes.
- Parent side navigation: Building, Dashboard, My Children, School Connections, Teacher Connections, Reports & Insights, Requests, Account & Go Live. The teacher-only entries (Lesson Notes, SmartBoard, Classes, Adventure, Skill Builder, Settings under the teaching hub) never appear for a parent.
- Any parent-facing link into `/teaching-hub/*` is removed, so a parent can never land on the teacher workspace shell.

## 2. Parent Console dashboard (`/family`)

Layout follows the mockup, built with the existing premium dark workspace tokens (navy panels, gold/violet accents) — no new visual language:

- **Greeting header**: "Good morning, {parent name}" with the sub-line about children's progress, plus a family selector chip showing the child count.
- **Stat row**: Children under your care, Schools connected, Teachers connected, Average progress.
- **My Children** cards (up to 3 per row): child name, role/level line, a donut for overall progress, and three metric bars — Assignments, Adventures, Skill Builder — plus schools/teachers counts and a **View Details** button opening the existing read-only child mirror at `/family/children/{id}`.
- **Schools Connected** panel: each school with the connection date and how many of the parent's children it covers.
- **Teachers Connected** panel: each teacher with their name/handle and children covered, plus "View all teachers".
- **Right rail**:
  - Quick Actions: Add a Child, Connect to School, Connect to Teacher, View Reports (wired to the existing connect dialogs and reports).
  - Recent Activity: latest child events (assignment completions, adventure milestones) from existing progress data.
  - Go Live card, unchanged behaviour.

Panels from the mockup with no data behind them (Messages, Calendar, Upcoming Events, Payments & Subscriptions) are left out rather than faked; the design's remaining structure is kept intact so they can slot in later.

Per-child progress keeps its expandable per-school / per-teacher breakdown, moved inside the child's detail area so the card stays as clean as the mockup.

## Technical section

- `src/pages/Index.tsx`: role-aware label/target already branches on `school`; add the `parent` branch (`/family`, "Parent Console").
- `src/components/workspace/workspaceNav.ts`: rewrite the `PARENT` groups to the list above; keep `COMMUNITY`, replace `ACCOUNT` for parents with an account group that does not point at `/teaching-hub/settings`.
- `src/pages/accounts/FamilyDashboard.tsx`: rebuilt as the Parent Console using `WorkspaceLayout` + `RailCard`/`StatCard` primitives so it matches the rest of the dark shell, with new presentational subcomponents (`ChildProgressCard`, `ConnectedList`, `QuickActionRow`) in `src/components/family/`.
- Child sub-metrics: `parent_child_overview` currently returns only one overall `progress` value. I have not verified whether assignment/adventure/skill-builder splits are already derivable, so step one is to check the existing progress tables; if the split is available, the RPC is replaced (additively, same name, extra columns) to return `assignments`, `adventures`, `skillBuilder`; if it is not, the three bars render from the values that do exist and the missing ones are omitted rather than invented.
- Schools/Teachers panels and Recent Activity read from the existing `my_connections` and child progress data through `src/lib/family/family.ts` (extended with `fetchFamilyConnections`), reusing `useConnections`.
- No change to the read-only child mirror routes, the connection approval flow, or any teacher/school surface.
