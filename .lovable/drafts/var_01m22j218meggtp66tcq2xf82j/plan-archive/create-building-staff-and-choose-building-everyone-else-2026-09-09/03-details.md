## Technical notes

**Role split at the entry point.** `AcademyEditorPage.tsx` currently renders one gallery entry (`ChooseBuildingPanel`). It becomes two labels over the same machinery: `canPublishToGallery()` (owner / co-admin / `can_manage_gpl_assets`) decides staff. Staff get **Create Building**, others **Choose Building** with publishing controls and the official source hidden except for reading. No second settings surface, no second gallery.

**Create Building workspace.** A focused route (`/academy/build`) reusing `HallwayScene` plus the existing `BuildingSettingsPanel` — no site header, search, top picks, language, or account chrome; settings order stays Start Point → Terminal Wall → Ceiling → Doors → Lock → Frames → Windows → Lighting → Effects. A sticky **Save** at the bottom opens a two-step dialog (name, then category with "New category…"), then calls the existing `publishBuildingToGallery` with `kind: "official"`. Creating a category inserts into `building_gallery_categories` server-side under the same staff check.

**Save always creates a new building.** Publishing already clones the working building via `cloneBuildingPackage`, so the source stays untouched and the chain Original → A → B → C works by reopening a gallery entry as the starting template. A **Last created** row in Create Building lists this publisher's recent entries; picking one runs `useGalleryBuilding`-style cloning into the staff workspace as the active editing building.

**Seeding Gallery Building #1.** A staff-only "Add the current building to the gallery" action publishes the existing active building with a chosen name and category. No data is written until it is used.

**Two master images.** `src/pages/homepage/HomepageBuildingPage.tsx` keeps `RING_SLOTS` (8 upper) and `CORE_SLOTS` (8 lower) and gains a first step ahead of the grid: two inputs reusing the existing `uploadGameAsset`, `makeTransparent` background removal, MATHGPL asset picking and preview. **Continue** writes the outer ref into the eight ring slot ids and the inner ref into the eight core slot ids as ordinary independent `slotOverrides` entries — plain copies, no linkage, so per-slot replace/revert keeps working. The step is skipped (with a "Edit master images" link back) once overrides exist.

**Storage.** The staged gallery migration already covers categories, entries (`official` / `community`), attribution and RLS. Only additions if needed: an index for "recent entries by publisher". Category creation and official publishing stay server-side; nothing new is required for persistence since entries and template buildings are already durable rows.

**Untouched.** Hallway/room geometry and navigation, door movement and locks, frames, windows, smart screens, Building Map, lighting, plan permissions, and MATHGPL Assets.
