# Two Workspaces, One Shell

Teaching Hub and MathGPL Live become two tabs of the same page instead of two different-looking screens.

## Top navigation

```text
[ Teaching Hub | MathGPL Live ]                    ⚙  ⛶
```

- A shared header with a segmented control on the left (Teaching Hub / MathGPL Live) and two small icon buttons on the right: Settings (gear) and Full Screen.
- Switching tabs changes the URL (`/teaching-hub` and `/live`) so links and back/forward still work, with a soft fade/slide between the two card grids.
- The gear opens the existing settings page; the full-screen icon toggles browser full screen.
- Settings is no longer a card in either workspace.

## Teaching Hub cards (4)

Lesson Notes · SmartBoard · Classes · Adventure

The MathGPL Live tile and the Settings tile are removed from the grid. Adventure keeps its artwork but is sized like every other card.

## MathGPL Live cards (5)

Sessions · Lesson Notes · SmartBoard · Gallery · Reports

Removed: the whole top banner ("Teach mathematics online", "Sessions replace classrooms", Create Session, Join with a code) and the Assignments, Adventure, Assessment and Settings tiles.

- Sessions opens the existing Sessions page, which already holds Create Session and Join with a code; scheduling and managing live sessions stay there.
- Gallery and Reports need a session first, so each opens a light session picker that lists the teacher's sessions and jumps into that session's Gallery / Report page.

## Visual consistency

Both grids render from one card component and one shared layout: same card size, radius, gradient treatment, icon size, typography, hover lift and spacing. Only the card list differs per workspace.

## Technical notes

- New `src/components/workspace/WorkspaceShell.tsx` (header + tabs + gear/full-screen + grid container) and `WorkspaceCard.tsx`; `src/pages/TeachingHub.tsx` and `src/pages/live/LiveHub.tsx` are reduced to a tile list plus the shell.
- Full screen via the standard `requestFullscreen` / `exitFullscreen` API, icon reflecting current state.
- Gear links to `/teaching-hub/settings` from both workspaces (single settings surface).
- Two new thin pages/routes for the Live pickers (`/live/gallery`, `/live/reports`) that read the existing `sessions` table and route to `/live/workspace/:classId/gallery` and `/live/workspace/:classId/report`. No schema changes, no feature pages touched.
