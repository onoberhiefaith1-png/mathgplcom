# Diagrams must never disappear

## What is actually happening

Your page diagram is drawn on an overlay whose only source of truth is this browser's local storage (`lesson-notes:notebook-geometry:<note id>`). The saved copy that goes into the lesson note is an invisible "carrier" object — it stores the drawing but deliberately renders nothing, because the visible version is supposed to come from the overlay.

So when you sign out and come back (new session, cleared storage, another browser or device):

1. Local storage no longer has the drawing, so the overlay starts empty.
2. Worse, the empty overlay then syncs itself into the document — and because "nothing drawn" means "remove the carriers", the saved copy in the database is deleted too.

That second step is why the diagram is gone permanently rather than just invisible.

## The fix

Make the lesson note (database) the source of truth, and treat local storage as a cache only.

1. **Hydrate from the note on open.** When the overlay mounts, read every saved page-layer diagram out of the loaded document and use it as the starting scene. Local storage is used only if the document has nothing (e.g. a drawing made seconds ago that has not been saved yet), and the richer of the two wins.
2. **Never delete on an empty scene.** The sync that mirrors the overlay into the document will only remove saved diagrams when the teacher actually erased them in this session (an explicit erase/undo action), never because the overlay happened to start empty. This alone stops all silent loss.
3. **Save promptly and on exit.** In addition to the current debounced write, flush the drawing into the document (and trigger the note's save) on page hide, tab close, and before sign-out, so the last strokes always reach the database.
4. **Recovery for the note you already lost.** Add a one-time repair pass on note open: if the document has no page diagram but this browser's local storage still holds one for that note, it is written back into the note and saved. If you last drew that triangle in this same browser, this restores it; if the storage entry is already gone, it cannot be recovered.

## Technical notes

- `src/components/lessonnotes/DocumentEditor.tsx`
  - `NotebookGeometryOverlay`: initial state becomes `sceneFromDocument(editor) ?? loadNotebookGeometry(...)`; re-hydrate when the note id or loaded document identity changes.
  - `syncPageGeometryNode`: replace the unconditional "no content → delete every carrier" branch with a guard requiring an explicit `allowClear` flag, passed only from user-initiated erase/undo paths.
  - Add a `flushPageGeometry()` helper wired to `visibilitychange`, `pagehide` and component unmount.
- No schema change: page diagrams already persist inside `notebooks.content_json` / block content as `geometryDiagram` nodes with `pageLayer: true`.
- Keep the carrier invisible in the editor (no double drawing) — hydration feeds the overlay, not a second render.
