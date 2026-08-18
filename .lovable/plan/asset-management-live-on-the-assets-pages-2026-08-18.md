# Asset Management, Live on the Assets Pages

The management controls move out of the admin console and onto the real Assets pages, visible only to you and to anyone holding an Asset Manager code. Everyone else keeps seeing exactly what they see today.

## What exists today (verified)

- `/assets`, `/assets/:category`, `/assets/:category/:subcategory` render the hard-coded catalogue in `src/data/assets.ts`. No add/edit controls anywhere.
- The database library (`gpl_asset_sessions`, `gpl_asset_subsessions`, `gpl_assets`, `gpl_asset_usage`) and its full CRUD (`src/lib/gpl/assetLibrary.ts`) already exist, plus an idempotent importer that registers the hard-coded catalogue as real rows without copying files.
- The add/edit screens currently live at `/admin/assets` (Level 1/2/3 pages) — the wrong place per your instruction.
- Write permission is `can_manage_gpl_assets()`, today "platform owner only".
- Access codes exist (`staff_codes`, `purpose = 'access'`) with a secret-entrance sign-in; there is no manager-specific code yet.
- Background removal already exists client-side (`src/lib/games/removeBackground.ts`), and an AI cover generator function (`generate-game-cover`) is already deployed.

## What changes

### 1. Controls live on the Assets pages

- `/assets` — top of the page gets **+ Add Session** (primary button, always visible for managers, never for others).
- `/assets/:session` — **+ Add Sub-Session**.
- `/assets/:session/:subsession` — **+ Add Asset**.
- Every card gets a hover `⋮` menu: Open, Edit, Rename, Change cover image, Activate/Deactivate, Delete (Delete always confirms and offers Deactivate instead).
- The pages read the database library first and fall back to the bundled catalogue, so nothing currently visible disappears. A one-click **Import existing library** action (manager-only, idempotent) registers the bundled folders as real rows so they become editable.
- Existing special behaviour is preserved untouched: 3D character billboards, Music Generator, Generative Video, and the Adventure video-FX picker keep working on their current subcategories.

### 2. Session and Sub-Session appearance

Each Session and Sub-Session card can be given a cover: upload an image, paste a URL, pick an emoji/icon, or press **Generate with AI** — a short prompt built from the folder name produces the cover and stores it. Same editor for both levels.

### 3. Adding an asset

One dialog handles: file upload (image, transparent PNG, GIF, video, audio, 3D model), or an emoji glyph, or a URL. Options:

- **Remove background** — runs the existing transparency step before upload, so the stored file is already transparent for end users.
- Name, description, and the **Usage** checkboxes (Adventure, Building Editor, Lesson Notes, Smartboard Board 1, Smartboard Board 2).
- Multiple files can be selected at once; each becomes an asset named from its filename.

### 4. Asset Manager access code

- New code kind in the admin console: **Asset Manager codes** — generate, label, see who holds it, revoke, delete. Same table as existing access codes, a different purpose value.
- Redeeming one at the secret entrance grants that person the Asset Manager capability and nothing else: they can add and edit assets on the Assets pages, and they never see the admin console, billing, users or any other admin area.
- `can_manage_gpl_assets()` becomes "platform owner OR asset manager", so every permission check and RLS policy already written keeps working.

### 5. Console cleanup

`/admin/assets` stops being the asset editor. The console keeps only the Asset Manager code panel and a link that takes you to `/assets`, where the real work now happens.

## Technical notes

- Migration (additive): add `asset_manager` to the `app_role` enum, extend `can_manage_gpl_assets()` to accept it, and allow `purpose = 'asset_manager'` codes. No table dropped or altered destructively.
- Server function additions for the manager code: generate/list/revoke (platform-admin gated) and a redemption path in the existing secret-entrance sign-in that inserts the `user_roles` row.
- New shared UI: `src/components/assets/manage/*` (AddSessionDialog, AddSubSessionDialog, AddAssetDialog, CoverEditor, CardActionsMenu, DeleteConfirm) reused by all three Assets pages.
- `src/pages/Assets.tsx`, `AssetCategory.tsx`, `AssetSubcategory.tsx` gain a manager gate via `canManageLibrary()`; non-managers render byte-for-byte the current view.
- `/admin/assets/*` pages are reduced to a redirect so any bookmark still lands somewhere sensible.
