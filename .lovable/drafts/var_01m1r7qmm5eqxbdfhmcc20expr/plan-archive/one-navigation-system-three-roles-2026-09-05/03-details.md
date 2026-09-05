## Technical notes

Files: `src/pages/accounts/TeacherDashboard.tsx`, `src/pages/accounts/SchoolDashboard.tsx`. No changes to `StudentDashboard.tsx`, `WorkspaceLayout.tsx`, `workspaceNav.ts`, routes, hooks, or queries.

Pattern copied verbatim from `StudentDashboard`:
- local `const [area, setArea] = useState<Area>("quick")`;
- `WorkspaceLayout ... collapsibleNav bottomInset={BAR_INSET + tabBar}` with `BAR_INSET = 92` and `tabBar` from `useBreakpoint() === "phone"` where a phone tab bar exists (teacher/school have none, so `tabBar = 0`);
- the same `fixed inset-x-0 z-[70] grid grid-cols-4 … pb-[calc(0.5rem+env(safe-area-inset-bottom))]` `<nav>` rendered as the last child inside `WorkspaceLayout`, same active styling and `aria-current`.

**Teacher** — existing JSX sections are wrapped as `{area === "quick" && …}` etc. Overview stat grid stays outside the switch. `My School` renders the current "School & students" block unchanged (schools list via `useWorkspace`, students via `useConnections`, `Manage connections` link with `useConnectionCounts`, `WorkspaceInvitations`). `useUpcomingSessions`, `useTeacherStats`, `useUpgradeGuard` and `QUICK` are untouched.

**School** — `SchoolDashboard` gains the same four-area switch: `quick` (existing `QUICK` pill list), `overview` (existing `StatCard` grid plus the School Report summary note text currently in the rail), `classes` (existing `ActivityList`), `reports` (the School Report card content, matching the left nav's existing `/school?tab=reports` entry). Per the earlier clean-dashboard direction, `ReferEarnCard`, `PlanSection` and `CreditsSection` are removed from the school main page — they remain reachable from the left navigation and the header credits chip. The existing `rail` is kept as-is.

Verification: `bunx tsgo --noEmit`, then an authenticated Playwright pass at 1280x1800 and 428x712 clicking all four teacher and all four school bar items, confirming the URL stays on `/teaching-hub` and `/school`, the bar holds position while scrolling, and the bar stays visible with the left panel open.
