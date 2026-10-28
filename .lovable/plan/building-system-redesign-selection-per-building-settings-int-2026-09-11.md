# Building system redesign — selection, per-building settings, interior kept separate

Four levels are currently mixed into one panel. They become four distinct places.

```text
TEACHING HUB (rotating building)
      |
      v
   BUILDING            <- new label, replaces "Settings"
      |
      v
BUILDING SELECTOR       one full building at a time, circular arrows
      |
   +--+-------------------+
   v                      v
SETTINGS (this building) ENTER BUILDING
   |                      |
   |- Change Background   v
   |- Edit Building     INTERIOR (rooms, hallways, doors, windows)
   |- Building Advertisement (administrator only)
```

## What changes for you

1. The item on the main page reads **BUILDING**, not Settings. It no longer opens editing options — it opens your buildings.
2. **Building Selector**: one whole building fills the screen, with `<` and `>` and "Building 3 of 10". The list wraps round: from the first, left goes to the last; from the last, right goes to the first. Keyboard arrows and swipe work too.
3. Three shelves at the top of the selector: **Public** (the administrator's master buildings), **Mine** (your own buildings), **Community** (buildings people shared). Each shelf is its own circular sequence, so one person's twenty variations never crowd everyone else's list.
4. Under the shown building: **Use this building**, **Enter building**, **Settings**, and — where allowed — **Delete**.
5. **Settings** always belongs to the building currently on screen: Change Background, Edit Building, and Building Advertisement for the administrator only. There is no second building list inside Settings, and no room/hallway controls there.
6. **Edit Building** edits only the outside: the outer picture, the inner picture, Generate to fill the sixteen positions, then free replacement of any single position. Rotation speed and background stay here.
7. **Save Building** never overwrites. Editing Building 5 and saving creates Building 11 with the complete interior copied across; Building 5 stays exactly as it was. A normal user editing a public building gets a private personal building — invisible to everyone else until they choose Share to Community.
8. **Enter building** takes you inside that building, where the existing interior editor (rooms, hallways, doors, windows, frames, screens, locks) works on that building only. Changing an exterior never resets an interior, and returning to a building brings its own interior back.

## Technical plan

**Data**
- `buildings` already carries `owner_id`, `org_id`, `exterior_config`, `thumbnail_url`, `source_building_id`, and every interior table is keyed by `building_id` — personal buildings need no new table.
- Public/community masters already live in `building_gallery_entries` (`published`, `exterior_config`, `template_building_id`, `kind`). Add `kind = 'community'` handling for user-shared buildings plus a `shared_by` read path; RLS keeps published masters readable and writable only by asset managers/owner (`can_manage_gpl_assets`).
- No exterior stays on `profiles.homepage_config` as a source of truth: the selected building's `exterior_config` drives the homepage; the profile value remains only a fallback for accounts with no building row.

**Selector (rewrite, not patch)**
- `src/pages/homepage/BuildingsGalleryPage.tsx` becomes the Building Selector: shelf tabs (Public / Mine / Community), circular `step()` (already modular), keyboard `ArrowLeft`/`ArrowRight`, pointer swipe, `RotatingAdventureScene` with the shelf entry's own `exterior_config`, and a bottom bar with Use / Enter / Settings / Delete gated by ownership.
- New `src/components/homepage/BuildingSettingsSheet.tsx` — per-building settings for the building on screen: Change Background (`/homepage/background?building=<id>`), Edit Building (`/homepage/building?building=<id>`), Building Advertisement (`/admin/advertisements`, `canManageAds` only), Save Building, Share to Community (own buildings only).
- `src/components/homepage/HomepageSettingsButton.tsx` is reduced to a single **BUILDING** link to `/buildings`; its Change Background / Edit Building / Save Building / Building option list is removed from the main page.

**Per-building exterior editing**
- `HomepageBuildingPage.tsx` and `HomepageBackgroundPage.tsx` take a `building` search param and read/write that row's `exterior_config` via `updateBuildingExterior`, instead of the account-wide profile config. Existing outer/inner master upload, Generate, per-slot replace, positioning, perspective and rotation-speed controls are kept untouched.
- Save routes through the existing `saveBuildingAsNew` server function (`keepContent: true`), which already copies the full interior package and writes the exterior onto the copy. For a public master edited by a normal user, the source is the master's `template_building_id` and the new row is owned by that user, not published.

**Interior stays where it is**
- Enter building = `activateBuilding(id)` then the existing academy/interior route (`/academy`, editor at `/academy/edit`), scoped by the active `building_id`. No interior controls are added to the selector or the exterior editor.

**Checks**
- Extend `src/lib/building/__tests__` with: circular navigation wrap at both ends; save-from-source leaves the source row's `environment` and `exterior_config` unchanged; a saved copy's interior rows all carry the new `building_id`; a personal copy of a public master is not visible to another account; delete removes only the chosen row.
- Typecheck, run the building tests, then verify signed-in in the preview: BUILDING label, wrap-around browsing, per-building settings, exterior save creating a new building, and an interior surviving a switch away and back.

## Out of scope

Hallway/room geometry, door and lock behaviour, Smart Screens, Building Map styling, and the advertisement editor itself all stay exactly as they are.
