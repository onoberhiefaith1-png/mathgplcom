# Smartboard Floating Tool Layers

Bring the five existing Lesson Note toolbar tools — **Diagram (2D/3D), Tables (mathematical reference tables), Graph, Calculator, Conversion** — onto the Smartboard as independent floating workspaces that sit *above* the board.

The Smartboard's writing/text-sensitive area, sensor, positioning and keyboard behaviour are not touched at all. Nothing about the separate Smart Table feature changes; the Tables button here means the mathematical reference tables (logarithms, four-figure, statistical, etc.) exactly as they exist in Lesson Notes.

## Behaviour

A new tool row on the board's top panel: **Diagram (2D / 3D) · Tables · Graph · Calc · Conversion**.

| Tool | Lifecycle |
| --- | --- |
| Diagram 2D | Open floating canvas → move / resize → draw → Complete (merge onto page) → Edit reopens the same object |
| Diagram 3D | Same, using the existing 3D workspace; adds an axes visibility toggle |
| Tables | Pick a table + value → floating table object → move / resize → Complete → Edit reopens the picker/table |
| Graph | Floating graph object → move / resize / expand → Complete → Edit reopens the same graph |
| Calculator | Floating movable calculator → use → Close (nothing merges) |
| Conversion | Floating movable converter → use → Close (nothing merges) |

Common rules for every floating layer:

- Movable by a grip, resizable from the corners/edges, collapsible, deletable.
- The layer blends with the board: it takes the board's own background/ink palette and stays translucent, so writing underneath ("Quadratic Equation") remains visible and a geometry line or graph can sit right over it.
- Deleting a layer removes only that layer, never board content.
- **Complete** commits the tool's structured object to the current board page — still a real object, never a flattened image. **Edit** reopens that same object in its floating layer.
- Undo/Redo on the board covers these actions in the same chronological history it already uses for handwriting, text and diagrams: undo after "draw circle" removes the circle, undo after typing undoes the text.
- Objects live on the page they were created on and are saved with it.

## Technical outline

**Shared floating shell (new)** — `src/components/smartboard/FloatingToolLayer.tsx`: absolute-positioned, board-palette-aware panel with drag grip, 8 resize handles, collapse, delete, and Complete/Close actions. Reused by all five tools so behaviour is identical. Board-theme blending comes from the existing `palette`/`isDark` values already computed in `PresentationView`.

**Board object model** — extend `src/lib/smartboard/boardDiagrams.ts` (or a sibling `boardObjects.ts`) from today's `BoardDiagram2D | BoardDiagram3D` to a `BoardObject` union adding `graph`, `table` kinds, each `{ id, kind, x, y, width, height, attrs }`. `sanitizeBoardDiagrams` gains the new kinds so older saved pages keep loading. Objects persist through the existing per-page key and are included in the existing `Snap` history so undo/redo already covers them.

**Reusing the Lesson Note tools unchanged**

- `GeometryDiagram` / `GeometryEditorPanel` and `Scene3DCanvas` / `Workspace3DDialog` are already standalone and already used by the board — they just move inside the new shell.
- `MathTablesPicker` and `ConversionPanel` are standalone dialogs (`open`/`onOpenChange`/`onInsert`) — mount them directly from the board.
- `SmartCalculator` is a standalone dialog — mount as a floating layer instead of a modal.
- `SmartGraphView` and `MathTableView` are TipTap node views that only use `node.attrs`, `updateAttributes`, `deleteNode`, `selected`. Add a thin adapter (`src/components/smartboard/NodeAttrsAdapter.tsx`) that feeds them a board object's `attrs` and maps `updateAttributes` to the board's `setObjects` patcher. No changes to the tools' own logic, so Lesson Note behaviour is preserved by construction.

**3D axes toggle** — `showAxisX/Y/Z` and `axisLabels` already exist in `scene3d.ts` and are honoured by `Scene3DCanvas`. Add one board-level "Axes" toggle on the 3D layer's chrome that flips all three plus labels together, hiding them visually while keeping them in the scene data.

**Explicitly out of scope**: the Smartboard writing sensor, `FreeWriteLayer`, `WritingSurface`, `MathTreeRender`, the bottom symbol panel, and the Smart Table feature.
