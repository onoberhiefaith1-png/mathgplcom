# Emoji Library for Lesson Notes

Add a teacher-owned emoji library that lives beside the lesson note as a right dock panel. The app supplies the structure only — the teacher pastes the emoji content.

## Toolbar button

A new `😊 Emojis` button sits in the lesson note ribbon, next to the existing Symbols/AI tools. Clicking it toggles the dock panel.

## Right dock panel (30 / 70 split)

- Opens docked on the right of the editor, ~30% of the editor width (min 280px, max 420px).
- The lesson note shrinks to the remaining width and stays fully visible and editable — the panel never overlays the page.
- Collapsible at any time via the toolbar button or an X in the panel header.
- It reuses the same docking mechanism as the existing Properties Panel, so both can coexist without overlap.

## Sessions (categories)

- The panel lists teacher-created sessions: create, rename, delete, and reorder (move up / move down).
- A new session starts empty. No preset categories, no generated content.
- Selecting a session shows its emoji grid.

## Emoji storage

- Each session holds one plain-text field. The teacher pastes any amount of Unicode emoji text into it ("Edit content" mode inside the panel).
- On save, the stored text is split on whitespace into individual clickable tiles for the grid. The original pasted text is kept verbatim so nothing is lost or reformatted.
- No AI, no auto-categorisation, no curation.

## Insertion

- One click on a tile inserts that emoji at the current cursor position in the lesson note, using the editor's existing insert path (the same one the Symbols panel uses).
- The teacher can click several emojis in a row and keep typing; focus returns to the note after each insert.
- Inserted emojis are ordinary text characters: they flow with the text, inherit surrounding size/colour/bold/italic/alignment, and support copy, delete, undo/redo, search, and print like any other character.

## Shared across the platform

The library is stored per teacher account in the backend, not per notebook. Once built, the same sessions and emojis appear in every lesson note that teacher opens, now and in the future.

## Technical notes

- New table `public.emoji_categories`: `owner_id`, `name`, `content` (text, the pasted emoji blob), `order_index`, timestamps. RLS: owners manage their own rows only; grants for `authenticated` and `service_role`; `updated_at` trigger.
- New hook `src/hooks/useEmojiLibrary.ts`: load, create, rename, delete, reorder, save content.
- New component `src/components/lessonnotes/EmojiPanel.tsx`: dock panel with the session list, the emoji grid, and the paste/edit textarea.
- `DocumentEditor.tsx`: add the toolbar button, panel open state, render `EmojiPanel` inside the existing flex row alongside `PropertiesPanel`, and pass the existing `insertSymbolText` as the insert callback (it already does `editor.chain().focus().insertContent(s).run()`).
- No changes to cursor/caret handling.
