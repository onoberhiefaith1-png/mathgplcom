## How it is put together

**Entry point.** On the build page, the current "The Building → Environment" entry is replaced by a single **Choose a Building** entry. Opening it shows the gallery full-bleed with the settings for the active building beneath the preview, so the existing settings panel is reused unchanged (Start Point → Terminal Wall → Ceiling → Doors → Lock → Frames → Windows → Lighting → Effects → Save) and no duplicate settings section remains on the page. Visibility follows the current edit permission: unchanged for free and read-only accounts.

**Gallery.** Category tags first (Modern, School, Ancient, Futuristic, Science, Office, and more, editable by admins). Choosing a category loads that category's buildings and shows one at a time as the main preview, rendered live with the existing 3D hallway renderer against the previewed building's own saved data. Swipe (touch), arrow buttons and keyboard left/right move between entries; entries load in pages so a 200+ collection stays fast. A **Use this building** action selects it.

**Complete package on select.** Selecting copies the full building rather than only the shell. The current duplicate routine copies hallways, doors and rooms but drops connections, locks, frames, frame links and window content, so it is extended into one full clone covering: building environment, walkway graph, hallway links and corridors, doors and their designs, room shells and per-room overrides, room locks (shape only, code re-set by the new owner), frames and windows with their pictures, and screen/background configuration. Learning content stays a reference, never duplicated. The copy becomes the active building; the source stays untouched.

**Publishing.** Owner and accounts granted Asset/Building Manager rights get **Save to Building Gallery** on the active building: name, category, optional description, then publish. Published entries record the complete configuration by cloning it into an admin-owned template, so later edits to the admin's working building never mutate what users see.

**Community.** After modifying a building, **Share to Community** publishes a community entry pointing at a frozen clone of that version. The community gallery is a second source in the same browsing UI, tagged as community. Using it clones again; removing a shared entry never touches the original or anyone's copy.

## Technical notes

- New tables staged as an additive migration in this draft (applied when the draft is accepted): `building_gallery_categories`, `building_gallery_entries` (name, category, source template building id, kind `official` | `community`, publisher, published_at, visibility), and a small `building_gallery_uses` record for attribution. Grants plus RLS on each: public read for published entries; insert/update/publish for `official` restricted to platform owner/co-admin and `asset_managers`; `community` insert restricted to the sharing owner.
- Buildings act as templates by owning flag plus `source_building_id`, which already exists.
- `duplicateBuilding` in `src/lib/building/api.ts` becomes `cloneBuildingPackage`, extended to links/corridors, locks, frames and frame links; existing callers keep working.
- Gallery reads and clone-on-select run through server functions so ownership and manager rights are enforced server-side, not just in the panel.
- No change to hallway or room geometry, navigation, Building Map, lighting or plan permissions elsewhere.

## Verification

Clone fidelity is unit-tested (every child table represented, content references not duplicated), the gallery is walked signed-in for category browsing, swipe/arrow paging and selection, an admin publish/select round trip is checked against the original staying unchanged, and a free-plan account is confirmed to see the default building with no Choose a Building entry.
