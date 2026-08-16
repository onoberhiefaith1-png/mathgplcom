# Companion Lesson Note workspace (replacing the Smartboard's second board)

The Smartboard's second board stops being a custom tool board. It becomes a second instance
of the existing Lesson Note editor, blank at first, belonging privately to the lesson note
currently on the board.

## What's true today (checked in the code)

- The Smartboard slides between two panes inside `PresentationView.tsx`: the writing board and
  `ToolsBoard.tsx`, which has its own canvas, its own history (`src/lib/smartboard/boardHistory.ts`)
  and a `BoardToolLayer` hosting Diagram / Tables / Graph / Calc / Conversion / Slide.
- The main board's top pill also carries its own Diagram, Tables, Graph, Calc, Conversion and
  Slide buttons, opening the same floating layers over the writing surface — the overlap problem.
- The Lesson Note editor is a single reusable component, `DocumentEditor`, driven by props:
  `documentJson`, paper size/style, zoom, `onDocChange`. `NotebookEditorPage` passes the
  notebook's `document_json` and saves changes back to the `notebooks` row.
- `DocumentEditor` reads the notebook id from the route (`useParams().id`), which is not present
  on the Smartboard route, and it namespaces some local state (canvas text boxes, notebook
  geometry) by that id — so a second instance needs an explicit id/scope to stay separate.

## Plan

### 1. Remove the tool-board system
- Delete `ToolsBoard.tsx` and the second-board pane, its storage key, and the tools-board history
  usage. `BoardToolLayer` / `FloatingToolLayer` stay in the codebase only if the main board still
  needs them; nothing new is built on them.
- Remove Diagram (2D/3D), Tables, Graph, Calc, Conversion and Slide from the Smartboard's main top
  pill, along with the now-unused open/close state for those floating layers on that board. The
  underlying tools remain fully available inside the Lesson Note editor.

### 2. Two-sided workspace switch
One compact control in the existing top pill: a two-sided arrow switch (`←` primary | secondary `→`).
Left goes to the writing board, right slides to the companion workspace. No "Board 1 / Board 2"
wording anywhere in the UI. The horizontal slide animation already in place is reused.

### 3. The companion workspace is the Lesson Note editor
The right-hand pane renders `DocumentEditor` on the existing white lesson-note page — same paper,
scrolling, ribbon, math tools, diagrams, graphs, tables, calculator, conversion and slides. No new
canvas, no new visual language, no extra tool panel. It opens blank for a note that has never used
it. It keeps a small "return to board" affordance consistent with the switch control.

### 4. Tied to the current lesson note
The companion content is stored on the lesson note itself, so:

- Differentiation → main board + its own companion page.
- Quadratic Formula → main board + a different companion page.
- Opening another note on the Smartboard shows that note's companion page, never another note's.

The companion page never appears in the Lesson Notes shelf or library — it is private to the note.

### 5. Saving and restoring
Companion edits autosave to the notebook row exactly the way the primary lesson note does
(debounced `onDocChange`). Leaving and returning to the same note restores both surfaces as they
were. The two surfaces never read or rearrange each other's content.

## Technical notes

- Migration (additive): add `companion_json jsonb` to `public.notebooks`. No new table, no policy
  change — existing notebook RLS and grants already cover the row.
- `useNotebook`: expose `companion_json` and a `saveCompanionJson` writer mirroring
  `saveDocumentJson` (debounced update on the same row).
- `DocumentEditor`: add optional `notebookId` and `scopeSuffix` props. When provided they override
  the route param used for local-state keys (`lesson-notes:canvas-boxes:*`,
  `lesson-notes:notebook-geometry:*`), so the companion instance gets `…:<id>:companion` and cannot
  collide with the primary editor. Default behaviour for existing callers is unchanged.
- `PresentationView.tsx`: replace the `ToolsBoard` pane with `DocumentEditor` fed by
  `companion_json` (loaded through `useNotebook` for the presented notebook id), plus the
  paper/zoom props defaulted locally; swap the board-switch button for the two-sided control and
  strip the six tool buttons from the pill. The writing surface, sensor, symbol panel, undo/redo and
  student mirroring on the main board are untouched.
- Delete `src/components/smartboard/ToolsBoard.tsx`; remove `boardHistory` usage that only served it
  if nothing else references it.
- Class board sync stays as-is: the companion page lives on the notebook row, so it follows the
  lesson note across devices without a new sync path.
