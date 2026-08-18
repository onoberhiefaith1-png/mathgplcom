# GPL Asset Management System — Session → Sub-Session → Asset

## What exists today (verified)

- `/assets` is a **hard-coded catalogue**: `src/data/assets.ts` lists categories (Rewards, Environment, Obstacles, Characters, Effects, UI, Props, Animations, Audio) and their sub-folders, with files bundled as `.asset.json` CDN pointers. Pages: `src/pages/Assets.tsx`, `AssetCategory.tsx`, `AssetSubcategory.tsx`. Nothing is in the database, so the administrator cannot add anything without a developer.
- Teacher-owned uploads are separate and stay separate: `game_assets` (Background / Reward / Progress Bar / Effect shelves in `AssetsPanel.tsx`, bucket `game-assets`), `custom_assets` (lesson-note library), `building_assets` (building snapshots).
- Emoji today is **teacher-only**: table `emoji_categories` (owner-scoped, one pasted blob per category) read by `useEmojiLibrary.ts` and shown in `EmojiPanel.tsx`, which is mounted from `DocumentEditor.tsx`. Because Board 2 is a second instance of the lesson-note editor, Lesson Notes and Board 2 already share that panel; Smartboard Board 1 has no emoji surface yet (it has `SymbolPanel.tsx`).

Nothing above is deleted. The hard-coded catalogue keeps working while the new system is filled in.

## New official repository

Three real levels, all administrator-created, no hard-coded folders:

```text
GPL Assets
└── Session            (Rewards, Environment, Emoji, …)
    └── Sub-Session    (Diamond, Coin, …)
        └── Asset      (Blue Diamond …)
```

New tables `gpl_asset_sessions`, `gpl_asset_subsessions`, `gpl_assets`, `gpl_asset_usage`:
name, description, icon/emoji, image, status (active/inactive), sort order, timestamps; assets add file path/URL, asset type (image, transparent PNG, gif, video, audio, emoji), and for emoji a `glyph` column instead of a file. Usage rows record destinations (Adventure, Building Editor, Lesson Notes, Smartboard Board 1, Smartboard Board 2). Files upload to the existing `game-assets` bucket under an `official/` prefix. RLS + GRANTs: platform owner (and later the GPL Asset Manager role) writes; every signed-in user reads active rows.

### Seeding, not duplicating

A one-time seed registers the current hard-coded structure as real Sessions and Sub-Sessions, and each bundled item as an Asset pointing at its existing CDN URL. No file is copied, no URL changes, and `src/data/assets.ts` stays in place as the fallback source until the seeded data is verified.

## Admin interface (`/admin/assets`)

Level 1 — GPL Assets: grid of Session cards (icon/image, name, sub-session count, Open). One primary button: **+ Add Session**. Each card has a `⋮` menu: Open, Edit, Rename, Change Image, Activate/Deactivate, Delete.

Level 2 — inside a Session: breadcrumb `Assets > Rewards`, Sub-Session cards, primary button **+ Add Sub-Session**, same `⋮` menu.

Level 3 — inside a Sub-Session: breadcrumb `Assets > Rewards > Diamond`, asset cards with live preview, primary button **+ Add Asset**. Per asset: Preview, Edit, Rename, Replace file, Edit description, Usage checkboxes, Activate/Deactivate, Delete. The detail view shows type, parent session, parent sub-session, status, created and updated dates.

Search box spans all three levels and matches session, sub-session, asset names, descriptions and emoji glyphs, returning results as breadcrumb paths.

Delete always confirms, names what is affected, and offers Deactivate instead; deleting a session or sub-session that still holds assets warns explicitly and never silently cascades files away.

Forms use the existing gold/GPL admin styling from the other `/admin` pages.

## Emoji: one central record, three surfaces

An "Emoji" Session holds emoji assets (glyph + name + status). A shared reader `src/lib/gpl/officialEmoji.ts` fetches active official emoji once and is consumed by:

- Lesson Notes — `EmojiPanel.tsx` gains an **Official GPL** group above the existing **My Emojis** groups.
- Smartboard Board 2 — same panel, no extra work.
- Smartboard Board 1 — the emoji picker is added to the existing symbol/tools rail using the same reader.

There is one record. Deactivating it removes it from all three surfaces. Teacher `emoji_categories` remain untouched and independent.

Other asset kinds get **no** automatic replacement of teacher galleries: official assets are readable where already supported (Adventure, Building Editor picker), and each teacher keeps their own `game_assets` shelves.

## Permissions

Writes are gated on the platform-owner capability path already used by `/admin`, expressed as a single `can_manage_gpl_assets` check in DB policies and UI so a future **GPL Asset Manager** employee role can be granted it alone. No employee login, gateway, code or dashboard is built in this change.

## Technical notes

- Migration: additive only — four new tables + GRANTs + RLS + `updated_at` triggers; no existing table altered or dropped.
- New files: `src/lib/gpl/assetLibrary.ts` (CRUD), `src/lib/gpl/officialEmoji.ts`, `src/routes/admin/assets/*` (index, `$session`, `$session/$subsession`), `src/components/admin/assets/*` (SessionCard, SubSessionCard, AssetCard, Add/Edit dialogs, Breadcrumbs, DeleteConfirm).
- Seeding runs from an admin-triggered "Import existing library" action in `/admin/assets` (idempotent, keyed on slug), so no data is written without the administrator asking.
- `/assets`, `AssetsPanel.tsx`, Adventure and Building Editor pickers keep working unchanged; the official library is added as an extra source, so existing URLs and relationships are preserved.
