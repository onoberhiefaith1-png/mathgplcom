# Hallway & Door Building System

Upgrade the existing 3D building — no rebuild. The world, navigation, movement, doors, surfaces and course routing stay exactly as they are. This plan corrects the structure (hallways connect into a maze, doors terminate paths), adds a real **End Wall** surface, renames the builder vocabulary, and turns the Building Map into a live minimap.

## 1. Terminology: Hallway, not Room

The builder shows exactly two add actions on any hallway:

- **+ Add Hallway** (Forward / Left / Right)
- **+ Add Door**

Labels change to "Hallway", "Add Hallway", "Add Door", and the panel is titled **Hallway & Door Building System**. The separate room/category/topic hierarchy panel keeps its data (courses already placed there are untouched) but is presented as the content library that doors point at, not as building structure.

## 2. End Wall becomes a real editable surface

Today the hallway's far wall is a plain plane borrowed from the left-wall colour. It becomes a fifth surface alongside Left Wall, Right Wall, Floor, Ceiling:

- New `endWall` surface in the environment settings, with the same controls as the others (template gallery, upload, colour, scale, offset, repeat, cover/stretch fit).
- Rendered on the capped far end of every hallway that has no forward continuation, so choosing an asset changes the visible end wall immediately.
- Existing buildings that have no stored `endWall` inherit the left-wall design so nothing looks broken or dark.
- The end-wall endpoint label stays as-is, drawn over the new surface.

## 3. Hallways form a maze (already relational — made explicit)

The walkway table is already a parent/child tree, and turns are already real 90° geometry. The editor makes this obvious and unlimited:

- From any hallway: add a Forward, Left or Right hallway; nesting is unrestricted, so `Main → Left → Forward → Right → …` keeps growing.
- Doors are endpoints: a door has no "add hallway" action under it, and a hallway may hold several doors.
- Clicking a door still zooms and opens the existing course/product page — unchanged.

## 4. Building Map → live minimap

Keep the map top-right, nudged inward so it can never sit under or over Settings (Settings stays fully clickable).

- Professional dark-navy rounded panel, blue visual language: dark blue for other hallways, medium blue for the active route, bright blue for the current segment, doors as clear markers, end walls as terminals.
- The red circle and the green start dot are removed. The player becomes a single blue glowing directional marker (chevron + soft pulse) that shows facing direction.
- The marker moves smoothly from the walker's real coordinates — it eases along straights and follows 90° corners rather than jumping, and it is driven by actual navigation state, never a canned animation.
- A small size control (S / M / L) scales the whole map proportionally; position stays fixed.
- Labels trimmed so the route reads instantly at the small size.

## 5. Preserved

Navigation, camera, collision, swipe/WASD input, door assets and styles, surface uploads and galleries, permissions (owner edits, students view), the room hierarchy data, and every existing course page.

## Technical notes

- `src/lib/building/types.ts`: add `endWall` to `SurfaceKey`, `EnvironmentSettings` and `DEFAULT_ENVIRONMENT`.
- `src/lib/building/env.ts`: `mergeEnvironment()` falls back `endWall → leftWall` for existing rows; add a test for that fallback.
- `src/components/academy/world/HallwayScene.tsx`: cap wall uses `<Surface>` with `env.endWall`; MiniMap rewritten (blue palette, sizes, animated interpolated marker, container offset).
- `src/components/academy/editor/BuildingSettingsPanel.tsx`: End Wall section reusing the existing surface editor, gallery and upload paths.
- `src/components/academy/editor/WalkwayManager.tsx` + `AcademyEditorPage.tsx`: hallway/door wording, add-hallway direction buttons per node, doors as leaf rows.
- No schema change needed — environment is stored as JSON on the building.
- Verify with `bunx vitest run buildingEnv buildingNavigation`, a typecheck, and Playwright screenshots of `/academy` (end wall material change + marker movement) and `/academy/edit`.
