# Buildings in GPL Assets + Website Editor asset picker

## 1. Your buildings live in GPL Assets

Today a building is a saved configuration (background, 16 artwork slots, optional replacement building) attached to your account or to the platform Free record. Nothing lists it as a reusable asset.

- Add a **Buildings** shelf to the GPL Assets library.
- Your existing **Pro Building** and **Free Building** are registered there as-is — same artwork, same slots, same rotating-building presentation. No new building is created and nothing is redesigned.
- Every time you press **Save** on a building page (Edit building, Replace building, Background, Advertisements), the saved state is also snapshotted into GPL Assets as a new building asset, named and timestamped (for example "Pro Building — 13 Aug 16:20"). Saving never overwrites an earlier snapshot, so you can go back to any previous building.
- From the Buildings shelf you can preview a snapshot, rename it, delete it, or **Apply** it to the Pro or Free building — applying restores that exact configuration.

## 2. Website editor Upload → File or GPL Assets

On `/admin/website`, each section's Upload button becomes a two-choice menu:

- **File** — the current behaviour: pick an image or video from your device, it uploads to your library and is used in the section.
- **GPL Assets** — opens your GPL Assets library (Backgrounds, Rewards, Progress Bars, Effects) in a picker dialog. Selecting an item uses that asset directly in the section, with no re-upload and no duplicate copy.

Building snapshots are configurations rather than media, so they stay on the Buildings shelf and are not offered as website section media.

## Technical notes

- New table `building_assets` (owner_id, version `pro`/`free`, name, config jsonb, thumbnail ref, created_at) with RLS + GRANTs: owner reads/writes own rows; platform owner also manages `free` rows. Additive migration only.
- `src/lib/homepage/buildingAssets.ts`: `snapshotBuilding()`, `listBuildingAssets()`, `applyBuildingAsset()`, `deleteBuildingAsset()`, plus a one-time `ensureCurrentBuildingsRegistered()` that registers the current Pro and Free configs on first visit.
- Hook the snapshot call into the existing `save()` path used by `HomepageBuildingPage`, `HomepageReplaceBuildingPage`, `HomepageBackgroundPage` and `HomepageAdvertisementsPage` Save buttons — no change to how the config itself is persisted or rendered.
- Add a `Buildings` tab to `src/components/gamebuilder/AssetsPanel.tsx` (list/apply/delete of `building_assets`), left out of the media grid logic.
- Extract a reusable `GameAssetPickerDialog` from `AssetsPanel` and wire it into `WebsiteContentPage`'s media control: a dropdown with File / GPL Assets, where GPL Assets returns `{ path: renderPathOf(asset), source: "storage", mediaType }` — identical shape to the current upload result, so signing and rendering are unchanged.
