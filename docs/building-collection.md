# Ten-building collection and "Clean transparency"

Status: **local branch `codex/ten-building-collection` only**. Nothing here is
deployed. The migration has not been applied to any Supabase project, the
collection has not been installed or published, and no live page has been
checked.

## What is in the branch

| Area | Files |
| --- | --- |
| Blueprints (10 buildings, 7 hallways, 11 rooms, 1 screen + 2 frames per room) | `src/lib/building/collection.ts` |
| Installer (one transaction, admin-only, repeat-safe, publishes to Public) | `supabase/migrations/20261118120000_ten_building_collection.sql`, mirror `drizzle/migrations/0031_ten_building_collection.sql`, server function `src/lib/building/collection.functions.ts` |
| Admin button | `BuildingsGalleryPage.tsx` → "Add ten-building collection" (bottom bar, confirm dialog) |
| Exterior art (ring + core per building) | `public/building-collection/<slug>-{exterior,core}.webp` |
| Interior art (wall, floor, ceiling per building) | `src/assets/surfaces/collection/<slug>-{wall,floor,ceiling}.webp`, registered as `builtin:<slug>-<part>` in `src/lib/building/collectionSurfaces.ts` |
| Proportional tiling | new surface fit `"tile"` (`imageFit.ts#tileFit`, `surface.tsx`, Building Settings → Fit → "Tile (keeps proportions)") |
| Clean transparency | `src/lib/games/imageTransparency.ts`, `src/components/homepage/TransparencyCleanupDialog.tsx`, wired into `HomepageBuildingPage.tsx` and `AssetFormDialog.tsx`; `makeTransparent` keeps existing alpha first |
| Tests | `vitest.buildings.config.ts` (collection + transparency), `.github/workflows/building-collection.yml`, `scripts/building-collection/installer-sql-check.ts` (PGlite run of the real SQL) |

## Artwork provenance

* **Exteriors.** The original transparent PNG ZIP was not available. The 20
  pictures were extracted from the full-resolution JPEGs embedded in the
  handoff PDF and their transparency was reconstructed by
  `scripts/building-collection/recover_pdf_artwork.py` (flat white backdrop
  connected to the frame edge, plus enclosed white areas such as open
  arches; pale stone with texture is kept). They are **not byte-identical to
  the originals**; replace them with the ZIP's PNGs (converted to WebP, same
  file names) when available.
* **Interiors.** 30 textures generated once at authoring time (image
  generation, no runtime AI), made seamless by
  `scripts/building-collection/make_seamless_surfaces.py` (edge cross-fade;
  walls wrap horizontally only so skirting and cornice stay put).

## Installing (after the migration is deployed)

Sign in as a platform owner or co-admin → Buildings → "Add ten-building
collection" → "Add and publish". The toast reports how many were created in
Mine and how many were newly published; a second run reports
"already installed and published" and adds nothing. Existing buildings, the
building in use and the Free/Pro defaults are not modified (the installer
only INSERTs new, inactive rows).

## Not included

No lifts, basements or quests are created or claimed. The SettingsPanel
"Remove background" label in the game builder is a video chroma key, not an
image transparency control, so it was left as it is.

## Clean transparency: known limit

A wall that is *exactly* the checkerboard's light colour (pure #fff on a
#fff/#ccc checker) and touches the checker can lose a corner of up to about
one checker square. Off-white stone, textured stone, glass and doorways are
handled (see `imageTransparency.test.ts`). The opaque-background remover
stays available as an explicit fallback in the review dialog.
