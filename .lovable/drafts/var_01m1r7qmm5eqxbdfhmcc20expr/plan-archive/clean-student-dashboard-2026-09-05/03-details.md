## Technical notes

**`src/components/workspace/WorkspaceLayout.tsx`** — add two opt-in props, defaulting to today's behaviour so every other role's page is byte-for-byte unchanged:
- `collapsibleNav?: boolean` — when true, the `lg:block` permanent `<aside>` is not rendered and the existing hamburger button loses its `lg:hidden`, so the already-built overlay drawer (same `nav` markup, same `navGroupsFor`) becomes the only nav on all widths.
- `railMode?: "column" | "drawer"` — in `drawer` mode the right `<aside>` is dropped from the grid (grid falls back to a single `minmax(0,1fr)` column, no reserved space) and the same `rail` node renders inside a right-hand slide-in overlay toggled by a new `Info` icon button placed next to the existing search/switcher in the header.

Both overlays reuse the current drawer pattern: backdrop button, `X` close, `z-50`, `Escape`-free parity with the existing one.

**`src/pages/accounts/StudentDashboard.tsx`** — pass `collapsibleNav railMode="drawer"`; reorder body to Hero → Learning (the four `AREAS` cards, prominent) → Connections; delete the `CreditsSection` import and usage; keep `PlanSection`. `My Schools` / `My Teachers` become two `<details>`-style collapsible cards (local `useState`) rendering the existing `ownerList` only when open; the "Waiting to be opened" block moves inside Connections. The `StatCard` strip and the inline Skill Builder list are dropped from the main column (progress lives in the info panel; Skill Builder keeps its Learning card and its own page) — no query or calculation changes, `useMyProgress`/`useMyAssignments`/`useMyAdventures` still feed the rail.

No route, loader, server function, table or policy changes. Verification: `tsgo --noEmit`, then an authenticated Playwright pass at 1280x1800 and 428x712 confirming the closed default state, both overlays opening, and each Learning card landing on its existing page.
