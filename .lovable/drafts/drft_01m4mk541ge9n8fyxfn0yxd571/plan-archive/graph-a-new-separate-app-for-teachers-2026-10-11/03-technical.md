### Technical details

- New, isolated module: `src/lib/graphApp/` (parsing via existing `mathjs`, sampling, implicit-surface meshing, n-cube projection, library data) and `src/components/graphApp/`; page under `src/pages/graphApp/`. No imports from `src/lib/graph/*` or the Smart Graph, so Lesson Notes/Smartboard graphs cannot change.
- Route `src/routes/graph.tsx`, wrapped in the existing teacher `RequireRole`, own `head()` metadata.
- Sidebar: one entry added after Academia in `workspaceNav.ts` teacher group.
- 2D renders on canvas (DPR-aware, cursor-anchored zoom, pinch). 3D uses the already-installed three / react-three-fiber with lightweight lines and vertex-coloured meshes, loaded only on this page (lazy, client-only), adaptive mesh resolution on phones.
- State is local to the page for Phase 1 (no database change).
- Tests: parser/evaluator values (e.g. y = x² at x = 2 → 4; z = x² + y² at (2,1) → 5), sphere mesh radius, tesseract has 16 vertices / 32 edges, library entries all parse.
- Record the isolation rule in `AGENTS.md`; verify signed-in in the browser on desktop and phone sizes, and confirm the Lesson Note graph still renders.
