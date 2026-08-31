# Map layering, centred minimap, named ENDPOINT, material persistence

Fixes to the existing Academy building navigation. The rotating building, hallway walking, doors, camera, breadcrumbs, minimap, editor and course pages all stay as they are.

## 1. Settings/Edit no longer blocked by the map

The map panel currently sits at `right-3 top-3` on layer 30, while the Academy top bar (Building / building switcher / Edit) sits on layer 20 — so the map is drawn over the Edit + building-switch controls in the top-right corner, exactly as in the screenshot.

- Put the top bar above the map in the stacking order, and keep the map below it.
- Offset the map so it starts below the top bar instead of behind it.
- Map panel stays non-interactive (clicks pass through); the top-bar controls stay clickable.
- Map keeps its current top-right position.

## 2. Map drawing centred inside the panel

The map currently scales the layout to fit and then pins it to a fixed 17px top-left padding, so a tall, narrow corridor hugs the left edge (visible in the screenshot).

- After scaling, centre the drawn layout on both axes inside the panel, with balanced padding on all four sides.
- Add a minimum span so a single short hallway does not fill the whole panel edge to edge.
- The player marker keeps moving inside the panel exactly as now (racing-game minimap behaviour).

## 3. A real, editable ENDPOINT node

Today the end of a hallway is just a blank capped wall. Adding a fifth named element:

- Each hallway gets an optional endpoint name, defaulting to **Building Exit** when the hallway has no forward continuation.
- Administrators rename it in the building editor next to the hallway name, exactly like hallway and door names; the name persists.
- In 3D: the endpoint name is shown on the end wall of the hallway it belongs to.
- On the map: an endpoint marker (with its name) is drawn at the terminating end of each route; when the walker reaches it, the marker highlights and the map shows the route end reached.
- Breadcrumbs gain the endpoint as the final node, e.g. `Main Hallway / Hallway A / Building Exit`.
- Left/right/forward/back navigation is unchanged; the endpoint is a terminal node, not a new movement direction.

## 4. Materials must survive reload

Verification first, then the fix. The saved configuration for the active building does contain custom colours, presets and templates — so the data is not being lost, the render is washing it out. Two concrete causes to confirm on screen before changing anything:

- Saved lighting values are multiplied by the brightness multiplier (a saved brightness of 2 with ambient 1.5 and intensity 2.35 produces a fully blown-out, white-looking corridor even though the surfaces have dark colours and textures).
- Older saved environments predate newer surface fields, and the current code only falls back to defaults when the whole environment is missing — never per field.

Work to do:

- Merge a saved environment field-by-field over the defaults, so an older or partial saved record keeps every value it does have and only fills in genuinely missing fields. No custom colour, preset or template is ever replaced by a default.
- Clamp the combined light contribution so an extreme saved brightness can no longer flatten every surface to white, while still letting administrators brighten a corridor.
- Keep a texture's own colours faithful, and apply the surface colour as a real tint rather than forcing white whenever an image is present.
- Confirm with a signed-in browser check: set distinct wall/floor/ceiling materials, reload, leave and re-enter the building, and confirm the surfaces render as saved.

## Technical notes

- `src/components/academy/world/HallwayScene.tsx` — map centring, map z-index/offset, endpoint marker + reached state, endpoint label on the end wall, lighting clamp, surface tint.
- `src/pages/academy/AcademyWorldPage.tsx` — top-bar layer above the map.
- `src/lib/building/types.ts` + a small migration on `building_walkways` — nullable `end_label` for the endpoint name.
- `src/lib/building/api.ts` — allow `end_label` in `updateWalkway`.
- `src/components/academy/editor/WalkwayManager.tsx` + `AcademyEditorPage.tsx` — endpoint name field wired to the existing rename flow.
- `src/lib/building/env.ts` (new, tested) — deep merge of a saved environment over `DEFAULT_ENVIRONMENT`.
- Verification: existing navigation tests plus new merge tests, typecheck, and an authenticated browser pass covering the acceptance list (settings clickable, map top-right and centred, marker moves, left/right/forward/back, endpoint rename shows in 3D and on the map, materials survive refresh).
