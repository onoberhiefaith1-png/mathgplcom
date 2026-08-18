# Emojis as an asset destination + copy/paste everywhere

## 1. "Emojis" becomes a real destination

Right now an asset can be sent to Adventure, Building Editor, Lesson Notes, Smartboard Board 1 and Smartboard Board 2. Add a sixth destination, **Emojis**, to the "Used in" checkboxes of the asset dialog.

Anything ticked as **Emojis** (a Unicode glyph, a transparent PNG, a GIF, a small video) shows up inside the Emoji Library panel under a **GPL Assets** group, in Lesson Notes and in both Smartboard boards, ready to click and drop into the page.

## 2. Inside the teacher's emoji session

A teacher creates a section (e.g. "house") and today can only paste Unicode text into it. The paste box gets a small source strip above it:

- **Paste** — as now: type or Ctrl+V Unicode emojis.
- **Upload from your system** — pick or drag image/GIF/video files; each becomes a tile in that session.
- **From GPL Assets** — a compact browser of official assets marked for the **Emojis** destination (Session → Sub-Session → asset thumbnails); clicking one adds it as a tile in the teacher's session.
- Ctrl+V of an actual image on the clipboard (a screenshot, a generated picture) drops straight in as a tile — no file dialog.

Sessions therefore hold two kinds of tiles: glyphs and media. Glyph tiles insert text as today; media tiles insert the picture/video into the note or board.

## 3. Copy and paste for all assets

- **Copy from an asset**: every asset card and every asset detail view gets a **Copy** action. Images copy as a real image to the clipboard (so they can be pasted anywhere); GIF/video/audio and 3D models copy their link, since browsers cannot put those on the clipboard as media.
- **Paste to create**: the Add-Asset dialog, the emoji upload strip and the asset grid pages accept Ctrl+V and drag-and-drop. Pasted images/videos are treated exactly like chosen files — multiple items in one paste become multiple assets, named automatically, with the same background-removal option.
- A newly generated picture or video can therefore be copied and pasted straight into GPL Assets or into an emoji session without saving to disk first.

## Technical notes

- `src/lib/gpl/assetLibrary.ts`: add `"emoji_library"` to `GPL_SURFACES` + `SURFACE_LABEL` ("Emojis"). No schema change needed — `gpl_asset_placements.surface` is text-backed; confirm before writing and add a check-constraint update only if one exists.
- Additive migration for teacher tiles: new `emoji_items` table (`id`, `category_id` → `emoji_categories`, `kind` `glyph|media`, `glyph`, `storage_path`, `external_url`, `media_type`, `sort_order`, `owner_id`) with GRANTs for `authenticated`/`service_role`, RLS scoped to `owner_id`. `emoji_categories.content` stays untouched so existing pasted text keeps working; the panel renders `content` glyphs plus `emoji_items` tiles.
- Teacher uploads land in the existing game-assets bucket under an `emoji/<owner>/` prefix.
- New `src/lib/clipboard/assetClipboard.ts`: `copyAssetToClipboard(asset)` (fetch → `ClipboardItem`, PNG re-encode fallback, link fallback) and `filesFromClipboard(event)`.
- `AssetFormDialog.tsx`: `onPaste` + drop handler appending to the existing `files` state; reuse the current multi-file save path.
- `EmojiPanel.tsx` + `BoardEmojiDock.tsx`: shared new `EmojiSourceStrip` and `GplEmojiPicker` components; `useEmojiLibrary` gains `addItems` / `removeItem`.
- Insertion callback widens from `(text: string)` to a tile union so media tiles can insert an image node in the note/board instead of text; existing glyph calls keep working.
- Fix the AdSense hydration mismatch by rendering the ad unit client-side only.
