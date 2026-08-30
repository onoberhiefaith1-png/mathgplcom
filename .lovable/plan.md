# Editable 3D Building / Academy Environment — Phase 1

## Goal

Turn the inside of the existing 3D building into an editable learning environment without rebuilding anything that works. The homepage rotating building stays exactly as it is; the Academy world (`/academy` corridor, hierarchy tables, editor) is extended so each workspace owner can customise the environment (walls, floor, roof, doors, lighting, effects), build extendable walkways with left/right branches, place doors that open existing courses, and switch between their own buildings — while viewers only walk, explore and open content.

## What is preserved (do not touch)

- The homepage rotating building, its per-account `homepage_config`, the 16 building slots, "Replace Building" editor, background layers and `building_assets` snapshots.
- The Academy relational hierarchy and its tables: `academies`, `academy_rooms`, `academy_categories`, `academy_topics`, `academy_subtopics`, `academy_placements`.
- The existing course/game/assessment engines and routes. Doors only open them; nothing is duplicated.
- Existing navigation, auth, upload infrastructure (`getSignedUrl`, storage) and the `is_workspace_member` / `can_edit_academy` permission helpers.

## New concepts

A **Building** is the 3D environment shell an owner enters: it owns surface designs, lighting, effects, a **walkway graph** (segments that extend forward and branch left/right) and **doors** placed along walkways that open existing content. The Academy hierarchy stays the content layer the building displays.

- Every workspace owner gets their own building, auto-created as "My Building" around the workspace's existing academy content.
- Changing one owner's building never affects another's (per-workspace rows).
- A viewer sees the published state; only the owner sees Edit controls, enforced in the database as well as the UI.

## Phase 1 scope

- Owner/View mode with an obvious VIEW | EDIT toggle.
- Per-workspace building ownership + a building switcher (extending the existing selector/header).
- "Duplicate Building": copies only the environment frame (surface designs, walkway structure, door designs, lighting, effects). Content associations are NOT copied — the duplicate starts with empty doors so the owner adds their own content.
- Environment panel: Left Wall, Right Wall, Floor, Roof/Ceiling, Door, Lighting, Effects. Each surface supports preset designs (Modern, Classroom, Academic, Minimal, Futuristic, Dark, Bright, Mathematics, Technology, Premium, Neutral), a solid colour, or an uploaded image/texture (auto-fitted, scale/position controls, repeat/cover).
- Lighting: brightness, ambient, intensity, atmosphere toggle. Always bright enough for classroom use.
- Effects: optional, enable/disable/preview per building, extensible later.
- Walkway system: Extend Walkway (+ Add Walkway at the end, no small artificial limit), left and right branches, natural-looking junctions.
- Movement: smooth forward movement with turn-left/turn-right that re-orients the camera to the new direction; keyboard + touch controls sized for classroom smartboards.
- Collision: the player stops at walls and walkway ends; branches are the only way to change direction.
- Doors: add along walkways, each an entry point into existing content (course, game, adventure, assessment — same polymorphic references as `academy_placements`). Selecting a door opens the existing course workspace (existing routes), with the existing class-context messaging for adventures/assessments.
- Live preview while editing; Save Changes; Preview as User.
- No room interiors, no new course/lesson/assessment/student engines.

## Database changes (one migration)

1. `buildings` — id, owner_org_id (nullable), owner_user_id, name, source_building_id (nullable, set by Duplicate), environment jsonb (surface designs, colours, texture refs, lighting, effects), is_active, created_at, updated_at.
2. `building_walkways` — id, building_id, parent_id (branch root), direction (forward/left/right), position, length, sort_order, timestamps.
3. `building_doors` — id, building_id, walkway_id, position_along, design jsonb (colour/preset/texture), content_kind + content_id (polymorphic, like `academy_placements`), timestamps.

Each table: GRANTs, RLS enabled, policies scoped so owners (org owner / workspace member with edit capability) manage their building rows and everyone else only reads published state. Timestamps via the existing `update_updated_at_column` trigger.

## Frontend changes

- `src/lib/building/types.ts` + `api.ts` — building CRUD, duplication (server-side copy of environment + walkway frames, empty doors), switcher list, walkway/door operations. Same patterns as `src/lib/academy/api.ts`.
- `src/components/academy/world/HallwayScene.tsx` — evolve the corridor into the walkway graph: segments render from `building_walkways`, camera follows forward/left/right with smooth turns, collision stops at walls/ends, doors render on segments and open content.
- `src/pages/academy/AcademyEditorPage.tsx` — add VIEW | EDIT toggle, environment panel (presets/colour/upload per surface, lighting, effects), walkway tools (Extend, Add Branch left/right, Add Door, associate content), Duplicate Building, building switcher, live preview.
- `src/pages/academy/AcademyWorldPage.tsx` — viewer mode: walk the active building, open doors, no edit controls.
- Reuse the existing upload flow (storage + `getSignedUrl`) for surface/door textures; reuse `resolveMediaUrl`-style resolution.

## Verification

- TypeScript build clean.
- Migration applies; RLS verified with the authenticated test account (owner can edit, other roles read-only).
- Browser E2E: finish the in-flight Academy checks (expand a room before "Add section"; clean stray rows), then: create building → customise wall colour → upload texture → add walkway → add left branch → place door → associate "Algebra mile" → Save → reload persists → Preview as User shows no edit controls → open the door and reach the course page → duplicate building and confirm the copy has the environment but no content.