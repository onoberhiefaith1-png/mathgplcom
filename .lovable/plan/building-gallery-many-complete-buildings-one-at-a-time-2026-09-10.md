# Building Gallery — many complete buildings, one at a time

## What changes for you

Today "Settings" on the homepage opens editing options, and the rotating outside of your building is stored once per account — so every saved interior shares the same exterior. This makes each building a complete, independent environment and gives you a proper way to browse them.

1. The homepage gear becomes a **Building** button.
2. **Building** opens the Building Gallery: one complete building filling the screen, with `←` and `→` arrows and swipe on touch. No grids, no small cards.
3. Under the building you get **Use this building**, **Edit / Building settings**, and **Delete building** (with a confirmation).
4. Editing a building and pressing **Save** never overwrites it — it always creates the next building. Building 1 stays exactly as it was; the changes become Building 2.
5. Each building carries its own outside picture, background, rooms, hallways, doors, frames, windows, screens and lighting. Choosing a building switches the whole environment.
6. Free accounts keep the single default building and see no gallery. Pro and owner accounts get browsing, saving and deleting.

## What already works (verified)

- A workspace can already hold many buildings (`buildings` rows with `is_active`), and every interior object — hallways, doors, rooms, locks, frames, windows, screens — is already stored against its own `building_id`, so interiors never mix.
- `cloneBuildingPackage` already copies a whole interior package into a new building while only *referencing* courses/adventures/assignments.

## What is missing (verified)

- The `buildings` table has no exterior/appearance column. The rotating exterior lives in `profiles.homepage_config`, one per account — this is the single reason all buildings currently look like one building.
- There is no one-at-a-time gallery view, no save-as-new-building, and no delete-building control.

## Technical plan

**1. Migration — exterior belongs to the building**
- Add `exterior_config jsonb not null default '{}'::jsonb` and `thumbnail_url text` to `public.buildings`.
- Backfill each existing building's `exterior_config` from its owner's `profiles.homepage_config` so nothing changes visually on first load.
- No new table; existing RLS/GRANTs on `buildings` already cover the new columns.

**2. Exterior read/write path (`src/lib/building/exterior.ts`, `src/lib/homepage/homepageConfig.ts`)**
- Read the active building's `exterior_config` instead of `profiles.homepage_config`; keep the profile value as a fallback only when a building has none.
- Exterior edits (`/homepage/building`, `/homepage/background`) write to the building row currently being edited.

**3. Save = create a new building (`src/lib/building/api.ts` + `clone.server.ts`)**
- New server function `saveAsNewBuilding({ sourceBuildingId, exteriorConfig, name })`: clone the source package with `keepContent: true`, apply the edited `environment` + `exteriorConfig` to the clone, leave the source row untouched, return the new id.
- Auto-name as `Building N` when no name is given.
- Wire the editor's Save (`AcademyEditorPage`, homepage building/background editors, `SaveBuildingDialog`) to this instead of in-place `update`.

**4. Building Gallery (`src/components/homepage/BuildingGallery.tsx`, route `/buildings`)**
- Loads `listBuildings(orgId)`, renders one building at a time using the existing rotating-building renderer with that row's `exterior_config`.
- Arrow buttons, keyboard `←`/`→`, and pointer-swipe change the index; name and position ("Building 2 of 5") shown above.
- Actions: **Use this building** → `activateBuilding(id, orgId)` then return to the homepage; **Edit** → existing editor scoped to that id; **Delete** → confirm dialog then delete that row only (interior rows cascade with it).

**5. Entry point (`src/components/homepage/HomepageSettingsButton.tsx`)**
- Relabel to **Building** and point it at the gallery. Keep Change Background and Edit Building as actions *inside* the gallery for the shown building; leave Account, Log Out, Platform Console, Community and Academy untouched.
- Gate the gallery on the existing `useBuildingContext().canCustomize`, so free accounts keep today's behaviour.

**6. Checks**
- Extend `src/lib/building/__tests__` with: saving from a source leaves the source row's environment and exterior unchanged; a clone's interior rows all carry the new `building_id`; deleting one building leaves the others intact.
- Typecheck, run the building tests, and verify the gallery signed-in in the preview.

## Out of scope

Hallway/room geometry, navigation, locks, the Smart Screen, Building Map styling and the Community gallery stay exactly as they are.
