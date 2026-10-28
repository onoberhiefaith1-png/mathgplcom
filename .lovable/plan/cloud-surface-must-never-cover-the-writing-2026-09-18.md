# Cloud surface must never cover the writing

## Problem
On the Cloud writing surface the text is drawn at the surface's front plane (z ≈ 0), but the cloud geometry bulges forward past that plane, so the writing ends up physically inside the cloud and disappears:

- `src/components/gameslate/world/sections/NewWritingSurface.tsx` — `Cloud()`: the base capsule sits at z = −0.2 with radius `height * 0.33`, and the puff lobes sit at z ≈ −0.13…−0.20 with radii up to ~`height * 0.375` (z-scaled 0.7). Both extend in front of z = 0 for normal region heights, burying the text.
- `src/components/gameslate/world/sections/SlateSection.tsx` — cloud ornament puffs sit at z = 0.015 with z-scale 0.45 and radius up to `bodyH * 0.34`, reaching z ≈ +0.17 — well in front of the text (z + 0.002/0.004), so puffs wash out or hide the writing on `new-cloud-panel` sections.

The cloud's look and its animated behaviour (smooth expansion via `useExpansion`) are correct and must be preserved.

## Fix (no redesign, cloud-only changes)

1. **Cloud writing surface** (`NewWritingSurface.tsx` → `Cloud`): keep the exact puff layout, radii, colours, and expansion animation, but sink the whole cloud so no geometry crosses the writing plane:
   - Move the base capsule back so its front face stays at or behind z ≈ −0.03 (centre z offset by its radius).
   - Place each lobe at `z = −0.03 − radius * 0.7` (its own front always behind the text plane) instead of the fixed `z − 0.18`.
   - Result: the cloud reads as a puffy body behind the writing, with the text always on top.

2. **Cloud ornament puffs** (`SlateSection.tsx` → ornament `cloud`): keep the puff positions around the top/bottom edges, colours and 0.86 opacity, but position each puff in z so its front stays behind the panel's writing plane (e.g. `z = −(radius * 0.45) − 0.01`) instead of the fixed `z = 0.015`. They remain visible as raised cloud relief behind the text.

3. Nothing else changes — surfaces, settings, rewards, editor, gameplay, navigation are untouched. Other surface kinds (Plain, Parchment, Royal, Crystal, etc.) are not modified.

## Verification
- `bunx tsgo --noEmit` typecheck.
- `bunx vitest run` slate tests.
- Playwright against the live preview: open the user's game slate with the Cloud surface, screenshot before/after — text clearly readable above the cloud, cloud still animated and puffy; also check a `new-cloud-panel` section.
