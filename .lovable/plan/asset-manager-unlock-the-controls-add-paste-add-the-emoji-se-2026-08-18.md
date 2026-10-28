# Asset Manager: unlock the controls, add paste, add the Emoji session

## What the checks show

Backend permissions are already correct — nothing there needs changing:

- `can_manage_gpl_assets()` returns true for the platform owner **or** the holder of an active `asset_manager` code, and the one issued code (label "CHIOCE") is claimed by the Asset Manager account.
- Every asset table (`gpl_asset_sessions`, `gpl_asset_subsessions`, `gpl_assets`, `gpl_asset_usage`) has a manage policy driven by that function, and storage has matching write/update/delete policies for the `official/...` prefix.
- The three levels of management UI already exist in code: `+ Add Session` on `/assets`, `+ Add Sub-Session` on `/assets/:session`, and the add/edit/delete asset controls inside each sub-session — all gated on `useAssetManager()`.

So the controls are built and permitted, but the Asset Manager isn't seeing them. The exact client-side reason is **not yet confirmed** (the likely candidates are the one-shot permission check in `useAssetManager` resolving before the session is restored and never retrying, or the published build being older than the preview). Step 1 is to confirm it by signing in as that account rather than guessing.

Two real gaps were confirmed:

- There is **no Emoji session** in the library (11 sessions exist; none is `emoji`), so `officialEmoji.ts` finds nothing and the Lesson Note / Smartboard emoji panels show no GPL emojis even though the plumbing for them already exists.
- Pasting only works **inside** the Add-Asset dialog. The asset grid itself is not a paste target, and there is no multi-select delete.

## Plan

### 1. Confirm and fix the permission check (no permission changes)

Sign in as the Asset Manager account in the preview, open `/assets`, and read the actual result of the permission call. Then fix what the check shows:

- Make the manager check resilient: re-run it when the auth session changes (sign-in, token refresh) instead of once on mount, and share the result so all three levels agree.
- Keep the rule exactly as it is: platform owner or asset-manager code holder. No new roles, no admin access, no extra areas.

### 2. Complete the third level

- On `/assets/:session/:subsession`, the manager sees `+ Add Asset` at the top of the asset area, plus per-asset Rename/Edit, Replace file, Activate/Deactivate, Delete and View.
- Where a folder exists only in the bundled catalogue, the manager gets a one-click action to register it so it becomes editable, instead of a passive note.

### 3. The asset area becomes a paste canvas

- The grid accepts Ctrl/Cmd + V and drag-and-drop directly: clipboard pictures/videos are imported into the current sub-session, named from the filename or auto-numbered.
- A pasted http(s) link becomes a link-backed asset.
- Multiple files or multiple pasted images create multiple separate assets in one go — never one merged asset.
- Selection mode: tick several assets, then Delete or Deactivate together.
- The existing file-picker upload path and the background-removal option stay exactly as they are.

### 4. Emoji session (the special case)

- Create the `emoji` session with sub-sessions as emoji groups, using the slug `officialEmoji.ts` already reads. This is the existing source of truth — no new emoji table.
- Inside an emoji sub-session the manager gets an emoji-first area: type or paste a run of emojis (`😀 😂 ❤️ ⭐ 🔥 🎯`) and each glyph is split into its own asset record. Media emojis (transparent PNG/GIF) are still allowed via the same upload path.
- New GPL emojis appear automatically in the Lesson Note editor and both Smartboard emoji panels through the existing `OfficialEmojiSection`; the in-memory cache is invalidated after a manager edit so they show up without a redeploy.
- Teacher emoji sessions (`emoji_categories` / `emoji_items`, owner-scoped) are untouched: GPL emojis render as a separate group above the teacher's own.

### 5. Verify

Sign in as the Asset Manager and walk the whole path: Add Session → Add Sub-Session → Add Asset (upload, paste, multi-add, delete), then add emojis and confirm they appear as separate items in the Lesson Note editor and on both Smartboard panels, with teacher emojis still working. Also confirm the Asset Manager still cannot reach the admin console or any non-asset area.

## Technical notes

- `src/lib/gpl/useAssetManager.ts`: cache the result in a module-level promise, subscribe to `supabase.auth.onAuthStateChange`, re-check on sign-in.
- `src/pages/AssetSubcategory.tsx` / `src/components/assets/manage/OfficialAssetSection.tsx`: paste + drop handlers reusing `filesFromTransfer` / `linkFromTransfer` from `src/lib/clipboard/assetClipboard.ts`, a bulk `createAsset` loop reusing `uploadOfficialFile`, and a selection bar.
- New `EmojiGlyphBulkDialog` splitting a pasted string with `Intl.Segmenter` (grapheme clusters, so ZWJ emojis and skin tones stay intact) into one `gpl_assets` row per glyph, each tagged with the `emoji_library`, `lesson_notes`, `smartboard_board_1`, `smartboard_board_2` surfaces that already exist in `GPL_SURFACES`.
- Emoji session/sub-sessions are created through the existing manager UI (normal rows), so no migration is required; `invalidateOfficialEmoji()` is called after every emoji write.
