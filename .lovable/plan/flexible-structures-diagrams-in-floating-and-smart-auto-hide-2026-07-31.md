# Flexible Structures, Diagrams in Floating, and Smart Auto-Hide Chrome

Six fixes, all in the lesson-note + smartboard presentation layer.

## 1. The solution must never appear by itself

Today, tapping a cell of a placed Smart Structure on the board makes the whole
teacher answer (3 3 4 / 6 5 7 / 9 9 1) show up at once. The cause is not yet
confirmed, so the first step is to prove it before changing behaviour. Two
candidates found while reading the code:

- Board cell values are cached in browser storage (`sb-table-state`) and
  restored on load, so an earlier session's values reappear.
- `StructureStage` reacts to the asset's own `onChange` by diffing the whole
  grid and writing back every cell that differs, so one normalising patch from
  the asset can commit many cells at once.

Fix, once confirmed:
- A placed structure starts completely blank. Only two things may show: the
  static structure (bracket, rules, minus signs, divider, "R", headings) and
  cells the teacher explicitly marked Retained on the floating page.
- Values enter one at a time, manually — by typing into a cell or by tapping a
  floating number. Never in bulk, never from the note's own answers, never
  from restored storage for a fresh board.

## 2. Everything drawn in the lesson note reaches the floating page

Right now the floating pipeline only accepts tables; diagrams are explicitly
skipped, which is why the 2D geometry line (C-B-A) never travelled.

- Any object in a solution — 2D geometry, 3D scene, graph, chart, animation,
  image, calculator/conversion output, any future asset — is carried through
  highlighting into the floating generation page.
- Highlighted object: becomes a floating workspace/line the teacher can place.
- Unhighlighted object: still travels, and lands on the board as locked
  notebook ink (a note), exactly like unhighlighted prose.
- Diagrams that have no editable cells appear as a single placeable item rather
  than a grid.

## 3. Delete on every diagram's right-hand panel

Every diagram (2D geometry, 3D, graph, and each asset panel such as
Place-value chart) gets a permanent "Delete diagram" action in its right-hand
Properties Panel header — available with nothing selected, not buried behind a
selected point or line.

## 4. Back button undoes the true last step

Board undo currently snapshots only written ink, offsets, smart lines and
boxes. Cell values, placed structures/diagrams and geometry edits are outside
it, so pressing back skips the line you just drew and removes numbers instead.

- Extend the board history snapshot to include table/structure cell values,
  placed-object anchors and diagram scenes.
- One press = strictly the last action, whatever it was: a digit, a drawn line,
  a placed structure, an erase.
- Redo mirrors it.

## 5. Geometry edit bar opens only on Edit

- Selecting a diagram shows it as a static figure with an `Edit` chip, like the
  table assets do.
- The left-hand geometry toolbox appears only after `Edit` is pressed, and
  closes when edit mode ends. It never opens by itself on selection or on
  insert.
- While not editing, you can still write over the diagram — it stays a
  background layer of the lesson.

## 6. Universal 10-second auto-hide for editing chrome

One shared behaviour for every in-place control cluster (`+ Column`,
`- Column`, `+ Row`, `- Row`, `Edit`, structure toolbars, chart expand/trim,
diagram chips, board rails):

- Visible while the pointer/caret is in or near the object.
- Fades after 10 seconds of no activity in that region.
- Returns instantly when the cursor comes back near the object, or on focus,
  or on keyboard interaction.

## Technical notes

- Diagnosis first: read the persisted `sb-table-state` payload and log
  `StructureStage.handleChange` writes to confirm which path fills the cells,
  then fix that path only.
- Floating pipeline: `src/pages/FloatingNumbersPage.tsx` currently drops
  non-table objects (`parsed.family !== "table"` → `continue`); replace with a
  generic object entry. `src/lib/floating/solutionItems.ts` already classifies
  every non-text node, and `syncDocumentToNotebook` already captures them, so
  no schema change is needed.
- Notebook fallback for unhighlighted objects reuses the existing
  `notebookOnly` highlight flag and the board's locked-ink path.
- Undo: widen the `Snap` type in `PresentationView.tsx` to carry
  `tableEntries`, `placedTables` and diagram scenes, keeping the cheap
  reference comparison.
- Auto-hide: promote `src/hooks/useAutoHide.ts` to a shared 10s
  proximity-aware wrapper (pointer-move distance test + focus ping) and use it
  in `TableActivityStage`, the arithmetic asset toolbars, `SmartGraphView`, and
  the geometry chips instead of each component's own timer.
- Geometry gating: `GeometryDiagram.tsx` swaps to `LiveEditor` on selection
  today; add an explicit edit state and drive `GeometryModeContext.setMode`
  from it so `GeometryToolbox` follows edit mode only.
