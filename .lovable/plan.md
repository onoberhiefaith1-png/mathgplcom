# Two Independent Boards + Transparent 2D Geometry

Board 1 (the existing Smartboard) keeps working exactly as it does today. Board 2 is a
brand-new, completely separate working board that lives beside it, reached by sliding
horizontally. It is not Slide, not a presentation mode, and it never merges with or
rearranges Board 1 content.

## What's true today (checked in the code)

- The whole board lives in one container (`#sb-root` inside `PresentationView.tsx`), with
  the top chrome pill holding Shelf, zoom, Prev/Next, Diagram, Tables, Graph, Calc,
  Conversion, Slide.
- The five tools already open as floating layers (`FloatingToolLayer` / `BoardToolLayer`)
  above the writing surface — which is exactly the overlap problem being solved.
- Board content is already saved per teaching context: the storage keys are built from a
  `boardScope` that includes the class id, the notebook id, game/assessment ids. So
  "Lesson Note X + Class A" and "Lesson Note X + Class B" are already separate states.
- 2D geometry currently renders inside the floating card: its panels scroll with the card
  and the card still reads as a bounded rectangle rather than a clear drawing layer.

## Plan

### 1. Board switch control
One new control in Board 1's existing top pill: a board-switch icon (Board 1 → Board 2).
Everything else in that bar stays untouched: Shelf, zoom %, Undo, Prev, Next.

### 2. Sliding two-board workspace
`#sb-root` gains an inner track holding two full-size panes side by side. Switching
translates the track horizontally: Board 1 slides left, Board 2 slides in from the right
(~300ms, no modal, no popup). Switching back reverses it. Both panes stay mounted, so
returning to Board 1 finds the lesson exactly as it was, mid-write.

### 3. Board 2 — an independent working board
Board 2 is its own canvas, not a view of Board 1:

- Its own top bar: **Return to Main Board**, plus **Diagram (2D/3D) · Tables · Graph ·
  Calc · Conversion · Slide**, and its own **Undo / Redo**.
- Its own scrollable, extendable canvas: the workspace grows downward as content is added,
  and scrolls vertically like Board 1's page.
- Its own object list and history. Nothing on Board 2 reads, moves, reorders or merges
  with Board 1 content, and vice versa.
- It follows the same board theme (surface colour, ink colour) so the two boards look like
  one product.

### 4. Independent undo/redo per board
Each board keeps its own history stack. Undo on Board 2 steps back through Board 2 work
only (draw circle, add graph, move a table); Undo on Board 1 behaves exactly as today.
Keyboard undo applies to whichever board is currently in view.

### 5. Persistence per lesson note + class
Both boards save under the same class-aware scope Board 1 already uses, so:

- Lesson Note X for Class A → Board 1 state A + Board 2 state A.
- The same Lesson Note X opened for Class B → both boards start blank.
- Closing the board never clears it; reopening in the same class context continues from
  where the teacher stopped, however long later. Only Undo or an explicit Clear empties a
  board.

Board 2 state is also written to the class board-state row so it survives a different
device or browser, matching Board 1's class sync.

### 6. Fix the 2D geometry workspace
On both boards, 2D geometry becomes a genuine transparent drawing layer:

- No box, no rectangle, no panel fill — only the drawing ink. Whatever is behind (board
  colour, writing, a graph) stays fully visible.
- Left and right tool panels are pinned to the workspace edges and stay put while the
  canvas scrolls vertically behind them; both remain independently collapsible.
- Drawing is allowed across the entire workspace area, not just inside a small card.
- Default ink is inherited from the board's current writing colour (dark board → light
  ink, light board → dark ink); per-object colour overrides are unchanged.

## Technical notes

- `PresentationView.tsx`: new `activeBoard` state, a two-pane translate track inside
  `#sb-root`, and the switch button added to the existing chrome pill. Board 1's markup,
  writing surface, sensor and keyboard handling are not modified.
- New `src/components/smartboard/ToolsBoard.tsx`: Board 2 shell — top bar, extendable
  scroll canvas, its own `BoardDiagram[]` + history, reusing `BoardToolLayer`,
  `MathTablesPicker`, `SmartCalculatorBody`, `ConversionBody` and `SlidePlayer` unchanged.
- New `src/lib/smartboard/boardHistory.ts` (or a hook) for the per-board undo/redo stack so
  both boards share the same implementation without sharing state.
- Storage: Board 2 uses `boardKey("board2", boardScope)`, keeping class + notebook scoping.
  Durable copy goes into the existing class board-state row under a new `board2` field.
- `GeometryWorkbench.tsx` / `GeometryCanvas.tsx`: edge-pinned panels, scrollable
  transparent canvas, no wrapper surface; `FloatingToolLayer` uses its transparent shell
  for the 2D kind.
- No changes to the writing sensor, `FreeWriteLayer`, `WritingSurface`, the bottom symbol
  panel, Smart Table, or the Slide editor in Lesson Notes.
- Database: one additive column/field on the existing class board-state row; no new tables.
