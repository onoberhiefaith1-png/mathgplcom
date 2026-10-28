## Technical notes

Single file: `src/components/workspace/WorkspaceLayout.tsx`. `StudentDashboard.tsx`, `workspaceNav.ts`, routes, panel components and data stay untouched.

**Docked column.** The `navOpen` block currently renders `fixed inset-0 z-50` with a `bg-ws-canvas/80 backdrop-blur-sm` scrim and an absolutely positioned `aside`. Replace it with two mutually exclusive renderings driven by a `lg:` breakpoint:

- Wide (`hidden lg:block`): an in-flow `<aside className="sticky top-0 hidden h-screen w-72 shrink-0 overflow-y-auto border-r border-ws-border/70 bg-ws-canvas/70 lg:block">` rendered as the first child of the existing `flex w-full` row, mirroring the non-collapsible column already there. No scrim, no `backdrop-blur`, no `fixed`. Its close (X) button stays, and the header ☰ toggles `setNavOpen(v => !v)` so it can be collapsed again; the main column is already `min-w-0 flex-1`, so it reflows without extra work.
- Narrow (`lg:hidden`): keep the existing slide-in `aside`, but swap the scrim to `bg-ws-canvas/60` with no `backdrop-blur-sm`, so phone content is dimmed rather than blurred.

**Bottom bar clearance.** The docked column gets the same `paddingBottom: bottomInset` treatment the drawer has, so it never scrolls behind the fixed four-area bar. The bar itself is already `fixed` in `StudentDashboard.tsx` and stays as is; the content column keeps its `bottomInset` padding.

**Panel selection.** With `keepNavOpen`, item clicks already skip `setNavOpen(false)` and `activeItem` already compares the `panel` search param, so navigation persistence and highlighting need no change. Building (`/`) and `/community` keep their real destinations.

**Rail drawer** (`Info` icon) keeps its modal treatment — it is an actual overlay panel, not navigation.

Verification: `bunx tsgo --noEmit`, then an authenticated Playwright pass at 1280x1800 walking the full acceptance sequence (each of the nine panel items in turn, confirming the URL stays on `/student`, the left column stays visible, no element with `backdrop-blur` covers the main region, and the bottom bar's bounding box is unchanged after scrolling), plus a 428x712 pass confirming the phone panel dims without blur.
