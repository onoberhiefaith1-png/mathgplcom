# MathGPL Academy — Two-Island Rotating Showcase (/adventure)

Rewrites `src/components/adventure/RotatingAdventureScene.tsx`. Only `Showcase` logic changes; `Adventure.tsx` (route + Back button) stays as-is.

## Behavior
- Only **two** island planes are ever rendered: one **Front** (facing camera), one **Back** (facing away). They orbit a shared central Y-axis and always face radially outward.
- The six academies cycle through over time: **MathGPL → Algebra → Trigonometry → Statistics → Geometry → Calculus → repeat**. Each takes its turn at the Front as the carousel turns.
- **Hidden swap:** when a slot rotates into the back zone (turned away, faded out), its texture is swapped to the next academy in the queue — the user never sees the change.
- **Clickable:** the Front island is clickable; rotation eases to a near-stop on hover. Clicking navigates to that academy (`/subjects/{slug}`; MathGPL → `/teaching-hub`).

## Depth & atmosphere
- Distance fog so the Back island reads as further away.
- Per-island opacity + scale fade based on facing angle (front large/opaque, back small/faint) for parallax depth.
- Soft radial contact-shadow blob beneath each floating island (canvas-generated texture).
- Bright magical lighting kept (warm + purple + blue accents).

## Remove / Keep
- **Remove:** the white circular cloud platform / rotating disk (`CloudFloor`).
- **Keep:** sky background, floating particles, magical lighting; **add** subtle purple energy-trail rings + purple particles.

## Camera
- Subtle cinematic drift: slow x/y float, gentle parallax, minor zoom breathing. Never jarring.

## Technical notes
- Two `IslandSlot` meshes (`planeGeometry`, billboard facing outward) on a shared rotation angle ref; base angles 0 and π.
- All six textures preloaded via `useLoader`; each slot holds a current index in state, swapped only inside the hidden back zone (`|phi - π| < 0.18`) guarded by a per-slot flag.
- Front slot tracked per-frame for click navigation via `useNavigate`.
- Performance goal met: two visible meshes at a time, textures preloaded, infrequent state updates on swap.
