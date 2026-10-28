# Global Quick Action bar + "Courses" rename

## What the teacher gets

- On the Teaching Hub: nothing changes. The bottom bar still shows Quick Action | Schedule | Activity | My School, and the Quick Action section keeps its five tiles.
- On every other teacher page (Lesson Notes, Smartboard, Classes, Adventure, Courses, students, school, requests, the classroom Smartboard, etc.): a single small lightning icon sits at the bottom-left.
- Click the lightning: the five destinations slide out horizontally along the bottom of the screen, in the same style as the Teaching Hub bottom bar — not a popup, not a card, not over the middle of the workspace.
- Click a destination: it navigates straight there and the strip closes.
- Click the lightning again: the five items collapse back to just the icon.
- Only teachers (and accounts acting as a teacher) see it. Students, parents and school accounts do not.

## Position control

- Default spot: bottom-left.
- Only the platform owner sees a drag handle on the icon. Dragging it and releasing saves the spot.
- The saved spot is global: every teacher on every device sees the icon in that place, and it survives refresh, page changes and signing out and back in.
- The icon always stays inside safe screen edges (including phone notches), and the expanded strip stays within the screen even when the icon is moved to the right or middle.

## "Skill Builder" becomes "Courses"

The app never actually said "Skip Builder" — the wording in the product is "Skill Builder". Per your decision it is renamed everywhere users can read it: sidebar and navigation labels, page titles and headings, cards, buttons, empty states, dialogs, and all 11 language files. Internal identifiers, routes such as `/course-builder` and `/student/skill-builder`, database columns and feature keys stay as they are so nothing breaks.

## Technical notes

1. **Shared source of truth** — extract the existing `QUICK` list from `src/pages/accounts/TeacherDashboard.tsx` into `src/lib/workspace/quickActions.ts` (destination, label key, icon, entitlement feature). The Teaching Hub section and the new floating bar both read this one list, including the existing upgrade-guard behaviour for locked features.
2. **New component** `src/components/workspace/QuickActionBar.tsx` — collapsed lightning button plus an expanding horizontal strip, rendered in a fixed layer. Mounted once inside `src/routes/__root.tsx` next to `PageGuideProvider`, so it is present on every route without touching individual pages. Hidden when the current pathname is exactly `/teaching-hub`, and hidden unless the viewer's active role is teacher (via `useAccount`/`useWorkspace`). Navigation uses `@/lib/router-compat` `Link`/`navigate` — client-side only, so Smartboard state, realtime channels and unsaved work are untouched (the layer never unmounts or resets board state; leaving a page is the same navigation the sidebar already performs).
3. **Placement storage** — new table `quick_action_placement` (single row, `key text primary key default 'global'`, `x_pct`, `y_pct`, `updated_by`, `updated_at`) with GRANTs, RLS: `SELECT` to `anon` + `authenticated`, `INSERT`/`UPDATE` restricted to `has_role(auth.uid(), 'platform_owner')`. Client helper `src/lib/workspace/quickActionPlacement.ts` mirrors the existing `src/lib/guides/placement.ts` pattern (percentage coordinates, clamping, load/save), so the same spot lands correctly on phone and laptop.
4. **Drag** — pointer-drag only when `isPlatformOwner`; on release the clamped percentages are saved and cached in the query client so all pages agree immediately.
5. **Rename sweep** — `rg -i "skill builder"` across `src/`, replacing only user-facing strings and the `nav_skill_builder` values in `src/lib/i18n/locales/*.ts`; leave `skill_builder` feature keys, file names and route paths alone.
6. **Verification** — typecheck, focused tests for the placement clamp/role gate, and a signed-in browser pass: Teaching Hub shows no icon; Lesson Notes and the classroom Smartboard show it; expand, navigate, collapse; move as owner and confirm the spot persists after reload.

## Note on the build error

The failed background build reports a git fetch/disk failure in the build infrastructure, not a problem in the project code. No source change can address it; it should clear on the next build.
