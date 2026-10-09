## Technical details
- New routes: `/game2` (gallery), `/game2/play/$gameId`, `/game2/slate/$gameId` — each with its own head() metadata. New pages under `src/pages/game2/`; components under `src/components/game2/`.
- Nav: add `{ to: "/game2", label: "Game II" }` after each `/game` entry in `workspaceNav.ts` (and quick actions), new label key.
- Data: reuse the existing games records and loaders/save functions read-only from the shared modules; no schema change, no new tables.
- Stage: plain DOM/CSS. Background via `<img>`/`<video>`; writing surface reuses the existing Floating Numbers board and grading calls; rewards rendered by a separate `pointer-events-none` fixed overlay driven by an event queue (like `FlyingRewards`), with CSS transform/opacity animations only, so reward state never re-renders the board.
- No three.js / WebGL imports anywhere in Game II.
- Files under `src/pages/game/`, `src/components/gameslate/` and their routes are not edited.
- AGENTS.md: add a rule that Game II is a separate DOM-only player over the shared game data and must not modify the 3D Game.
