## Technical details
- Capture: a Playwright script against `/dev/surfaces` (extended with a `?id=` single-surface, no-text, transparent-background mode) renders each `NewWritingSurface` or section mesh at a fixed aspect. The result is saved as a trimmed PNG/WebP and uploaded with `lovable-assets` to `src/assets/imagine/surfaces/<id>.webp.asset.json`.
- Mapping: `src/lib/imagine/surfaceSkins.ts` gains `surfaceImage(id)` plus per-surface 9-slice insets (left/right/top/bottom). Rolled scroll ends and cloud puffs sit inside the fixed slices.
- Render: in `ImagineStage.tsx`, the surface card uses `border-image: url(...) <insets> fill / <widths> stretch` (or `round` for wood and stone grain), with the existing content-driven width and height. The old `.imagine-skin--*` CSS stays as a fallback while an image loads and for plain, transparent and none.
- No three.js import enters Imagine (AGENTS.md rule). The shared Game files are untouched.
- Verify: view each captured image, then use Playwright on Imagine play at desktop and phone widths with short and long equations to check edges, growth and that text stays inside the surface.
