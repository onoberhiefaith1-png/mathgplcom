## Technical notes

Files: `src/components/workspace/workspaceNav.ts`, `src/components/workspace/WorkspaceLayout.tsx`, `src/pages/accounts/StudentDashboard.tsx`. No routes are removed and no page component is rewritten.

**Panel routing.** `/student` gains a `panel` search param (`classes | assignments | adventure | courses | schools | teachers | requests | account | golive`, default `undefined` = the four-area home). `StudentDashboard` reads it and renders the existing content component directly in its main column: `StudentClassesPage`, `StudentAllAssignmentsPage`, `StudentAllAdventuresPage`, `StudentAllSkillBuilderPage`, `RequestsPage`, `MyAccountPage`, `WorkspaceGoLive`, plus the existing schools/teachers `ownerList`. All of these are already pure content components with no shell of their own, so no extraction is needed. Their standalone routes stay for direct links.

**Left navigation.** In `workspaceNav.ts` the `STUDENT` groups drop the `/student` "Dashboard" item, rename Skill Builder to Courses, and point every panel item at `/student?panel=…`; Building (`/`) and `/community` keep their real destinations. Student groups no longer reuse shared `COMMUNITY` (which carries `/requests`) — a student-specific group lists MathGPL Community and a `?panel=requests` Requests entry, and Account/Go Live become panel entries too.

**Shell behaviour.** `WorkspaceLayout` gains `keepNavOpen?: boolean`: when set, item clicks do not call `setNavOpen(false)`. Active-item highlighting compares the `panel` param, not just the pathname, so the current panel reads as active. The header ☰ button is already inside the sticky header; verify it stays visible in `collapsibleNav` mode at both widths.

**Fixed bottom bar.** The four-area `<nav>` moves out of the scrolling content into a `fixed inset-x-0 bottom-0 z-40` element rendered by `StudentDashboard` (portal not needed; it sits outside the scroll container), with `pb-[env(safe-area-inset-bottom)]` and a matching bottom padding on the main column so nothing hides behind it. Its z-index sits above the content but below the nav drawer overlay so the drawer never covers it — the drawer panel keeps a bottom inset equal to the bar height when `keepNavOpen` is on.

**Overall View.** The `overall` node keeps only the Overall progress, Class progress and Waiting-to-be-opened `RailCard`s; the Go Live `RailCard` (with its Requests link) is deleted from it. `PlanSection` stays on Learning only.

Verification: `bunx tsgo --noEmit`, then an authenticated Playwright pass at 1280x1800 and 428x712 walking each left-nav item to confirm the URL stays on `/student`, the list stays open, the bar does not move on scroll, and Overall View shows exactly three cards.
