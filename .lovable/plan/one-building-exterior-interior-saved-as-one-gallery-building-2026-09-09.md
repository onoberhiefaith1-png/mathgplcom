# One Building = Exterior + Interior, saved as one gallery building

Today the Building Gallery already stores the complete interior (hallways, doors, rooms, locks, frames, windows, TVs, lighting, effects) and copying a gallery building never touches the original. Two things are missing against the architecture you described:

- The rotating exterior (the 16 artwork positions, its rotation speed and background) is stored on the account's homepage, not with the gallery building. So a gallery building today carries the interior but not its face.
- Saving a building lives only inside the interior editor. From Building Settings on the homepage there is no "Save Building".
- Learning links (a door or frame pointing at a Course / Adventure / Assignment) currently travel with a published building. They should not.

## What will change

### 1. The exterior travels with the building

Each gallery building gains a stored exterior: the 16 artwork positions, rotation speed, background and any replacement building image/video, captured exactly as it looks at the moment of saving.

The gallery card shows that exterior as the building's face, so the gallery reads as Calculus Castle, Algebra Academy, Statistics Tower — not as unlabelled interiors.

### 2. Save Building from Building Settings

The homepage Settings menu (Change Background · Edit MathGPL Building · Building Advertisements) gains **Save Building** and **Building Gallery**.

Save Building asks for a name and a category, then creates a **new** gallery building from the current exterior plus the interior of the building you are working on. It never overwrites an earlier one, so Building 1 → Building 2 → Building 3 … grows into a library of complete buildings.

The existing Save button inside the interior editor keeps working and creates the same complete package, so there is one saving behaviour, not two.

### 3. Choosing a building brings everything

Selecting a gallery building copies the interior into your workspace exactly as it is now, and additionally applies the saved exterior to your homepage building, so you land on the finished building instead of an empty shell. The gallery master stays untouched; your changes afterwards are yours alone.

Before the exterior is replaced, the current exterior is filed into the Buildings shelf first, so nothing you had is lost.

### 4. Links do not travel

When a building is saved to the gallery, and when a gallery building is copied to someone, door and frame connections to Courses, Adventures and Assignments are dropped. The rooms, frames and screens arrive; the connections are made by whoever uses the building. Original courses and adventures are never touched.

### 5. Permissions stay as they are

- Platform owner / co-admins / asset managers: save into the official MATHGPL Gallery and maintain the masters.
- Everyone else: choose a gallery building, edit their copy, share their version to Community. They cannot write into the official gallery.

## Technical notes

- Migration: add `exterior_config jsonb` (plus optional `exterior_thumbnail text`) to `building_gallery_entries`.
- `publishBuildingToGallery` gains an `exteriorConfig` input, captured client-side from `useHomepageConfig`, and calls `cloneBuildingPackage` with `keepContent: false`.
- `useGalleryBuilding` returns `exterior_config`; `loadGalleryBuilding` returns it too for the gallery card face. Also clone with `keepContent: false`.
- Caller applies the returned exterior through the existing homepage config save path (`snapshotBuilding` first, then `save`), so the Buildings shelf keeps the previous version.
- New surface: `SaveBuildingDialog` reused by `HomepageSettingsButton` and by `ChooseBuildingPanel`; gallery browsing on the homepage reuses `ChooseBuildingPanel`/`galleryEntries` — no second gallery implementation.
- Unchanged: hallway/room geometry, navigation, Building Map, lock system, door and frame visuals, advertisements.
