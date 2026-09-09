## Technical detail

### Frame and window content

- `uploadFrameImage` in `src/lib/building/frames.ts` writes to
  `building-frames/<frameId>/...`. The `game-assets` storage policies require
  `(storage.foldername(name))[1] = auth.uid()::text`, which is why the upload
  raises `new row violates row-level security policy` (confirmed in the runtime
  errors, stack at `frames.ts` → `FrameManager.onFile`). Change the key to
  `<uid>/building-frames/<frameId>/<ts>.<ext>`, surface upload failures as a
  toast instead of an unhandled rejection, and keep `content_path` as the only
  thing written on the frame row.
- Replace the built-in-only strip in `FrameManager.tsx` with a picker that lists
  the MathGPL library (`listSessions`/`listSubSessions`/`listAssets` from
  `src/lib/gpl/assetLibrary.ts`, image types only) plus the existing
  `SURFACE_SAMPLES`. Selecting stores the asset's `storage_path` (or
  `builtin:<key>` / external URL) in `content_path`.
- `resolveEnvironmentTextures` already accepts `extraPaths`; verify frame content
  paths from the library resolve for both `AcademyWorldPage` and the editor
  preview, and add missing paths to the `extraPaths` list rather than a new
  resolver.

### Shape and placement

- Keep the existing `offset_along`, `offset_y`, `width`, `height_ratio` sliders;
  add Portrait / Square / Landscape preset buttons writing `height_ratio`
  (≈1.35 / 1.0 / 0.62) and widen the ratio clamp in `frameSize` to 0.3–1.8 so
  a tall portrait window is reachable. Windows use the same controls as frames.

### Save button

- `BuildingSettingsPanel`'s `dirty` flag only tracks the environment draft.
  Lift a "frames changed" signal from `FrameManager.onChanged` so the button
  reads correctly; frame edits stay immediate writes, and pressing Save simply
  flushes the environment draft and clears the indicator.

### Asset library plus tile

- On `src/pages/AssetSubcategory.tsx`, render a first "+" card when
  `useAssetManager().isManager` is true. It opens a hidden multi-file input,
  uploads through the existing official uploader in `assetLibrary.ts`
  (`official/<session>/<sub>/...`, already covered by the manager storage
  policy from migration `20260818065523`), then calls `createAsset` per file
  with a slug derived from the filename and the next `sort_order`.
- No new permission model: the plus tile uses the existing platform-admin /
  `asset_managers` check, and created rows are active immediately, so every
  account can use them.

### Untouched

Hallway and room geometry, navigation, doors, locks, the Building Map, lighting,
effects, Smart Screens, and the frame/window 3D profiles themselves.
