# One continuous editable canvas + Dustbin, Archive separation

Three separate changes: (1) Note Extend must grow the *editable* workspace, (2) the toolbar loses Advanced and gains a draggable Dustbin for 2D content, (3) Archive becomes a Lesson Note management area, never a workspace tool.

## 1. Extend Note must extend the editable canvas

Confirmed cause: the page sheet and the interactive layer are two different boxes.

- `PageFrame` adds the extra Note Extend height as `paddingBottom` on the sheet's inner wrapper.
- The interactive layer (`paperLayerRef`) is a child *inside* that wrapper, so its own height never grows.
- Everything interactive is sized from that layer: the notebook-wide geometry overlay/`GeometryCanvas` measures `paperLayer.scrollHeight`, and blank-paper clicks (free text boxes) are handled by the layer's own mouse handler.

Result: the sheet gets taller, the editable/drawable surface does not — exactly the behaviour in the photo.

```text
today                          after
┌── sheet ─────────────┐       ┌── sheet ─────────────┐
│ ┌ interactive layer ┐│       │ ┌ interactive layer ┐│
│ │ content           ││       │ │ content           ││
│ └───────────────────┘│       │ │                   ││
│   padding (dead)     │       │ │ extended space    ││
└──────────────────────┘       │ └───────────────────┘│
                               └──────────────────────┘
```

Change:

- Stop expressing Note Extend as sheet padding. The extra millimetres become real height *inside* the interactive layer, so the layer, the geometry overlay, the geometry canvas and the blank-paper click surface all grow by exactly the same amount, whether or not the content has already passed one page height.
- Extended region therefore accepts everything the original region accepts: 2D Diagram drawing, free text boxes with double-click editing, sensors/objects, assets, selection and properties — no separate mode, no second surface.
- Note Shrink keeps working: the trailing-blank measurement must ignore the extension spacer itself so shrinking still reclaims only genuinely empty space and never cuts into content.
- Extra height stays persisted exactly as now (`page_extra_mm`), so re-opening a note restores the same extended canvas.

## 2. Toolbar: remove Advanced, add Dustbin

Final toolbar: Stencil | Asset Library | Section | Diagram | Table | Graph | Calculator | Conversion | **Dustbin**

- Remove the Advanced button and its inline group from the toolbar. The tools it hid (math insert, Animate/Capture Step, symbols) stay reachable from their existing homes (Asset Library / Section AI / math shortcuts) — nothing is deleted, just off this toolbar.
- Add a Dustbin button in that position. Pressing it lifts a dustbin object that follows the pointer over the page and wipes what it touches on release path, mirroring the Smartboard duster behaviour (`PresentationView`'s draggable eraser + its per-target hit-testing), reusing that logic rather than inventing a new deletion system.
- Scope: only 2D Diagram content — points, lines, segments, circles/arcs, polygons, regions, angle/distance annotations and labels held in the notebook geometry scene. It hit-tests the geometry scene and erases through the existing geometry erase operation, which keeps undo/redo intact.
- It must never remove lesson-note text, math structures, tables, graphs, 3D scenes or free text boxes.
- Releasing the dustbin returns it to the toolbar.

## 3. Archive is a Lesson Note feature, not a tool

- Archive never appears on the workspace toolbar and is not part of the Asset Library.
- Lesson Notes gains an Archive area: a note can be archived from its card menu (next to Rename/Duplicate/Delete), archived notes leave the active list, and the Archive view lists them with Open and Restore.
- Restore returns the note to the active Lesson Notes list unchanged.

## Technical notes

- `src/components/lessonnotes/PageFrame.tsx`: extra height moves from inner `paddingBottom` into the content host so the child interactive layer inherits it; a marked spacer (`data-note-extend-spacer`) covers the case where content already exceeds one page.
- `src/components/lessonnotes/DocumentEditor.tsx`: `trailingBlankMm()` skips the spacer; toolbar edits (drop Advanced block, add Dustbin); dustbin drag layer mounted over the paper layer.
- Dustbin erasing runs through `eraseObject` in `src/lib/geometry/editor/sceneOps.ts` against the notebook geometry scene (`NotebookGeometryOverlay`), so only 2D objects are eligible.
- Archive: additive migration adding a nullable `archived_at` to `public.notebooks` (no data rewrite, existing policies already scope by owner); `src/pages/LessonNotesPage.tsx` filters `archived_at is null` and gains Archive/Restore actions plus an Archive view. No changes to class-stored notes or the checkout/save-back flow.
