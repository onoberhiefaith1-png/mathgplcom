# Smart Table cells become first-class Lesson Note content

Smart Table cells are currently plain strings held inside a single atomic editor node. Because the whole table is one atom, the editor's selection never reaches inside a cell, so the floating toolbar and AI Edit can't see cell content — and raw source such as `x_{i}` or `(x_i - μ)^{2}` is printed literally instead of being rendered as mathematics.

The fix keeps the table's data model (fast, stable, already saved everywhere) but connects each cell to the same rendering and AI Edit pipeline the rest of the note uses.

## What changes for the teacher

1. Cell content renders as real mathematics — fractions, powers, subscripts, radicals, summations, Greek letters — identical to the rest of the note. No more `x_{i}` or `^{2}`.
2. Clicking a cell opens it for editing as before; text inside is selectable, including partial selections.
3. Selecting text in a cell (or focusing a cell without selecting) shows the same floating toolbar: Copy, Cut, Delete, Duplicate, Comment, AI Edit.
4. Clicking AI Edit opens the usual AI Edit panel, pre-loaded with the selected cell text. Applying the result rewrites only that cell — the table is never regenerated.
5. Partial selection applies back to only the selected portion of the cell; whole-cell selection replaces the cell.
6. Undo/redo, copy and paste behave the same as elsewhere, since every cell write goes through the existing editor transaction.

## Generation pipeline

When the AI generates a table, each cell now passes through the same normalisation and hygiene layer AI Edit uses before it is stored, so generated cells arrive already valid and already renderable. Cells that fail normalisation are stored as-is and stay editable rather than being dropped.

## Technical outline

- **Shared AI Edit bridge** (new `src/hooks/useAiEditBridge.tsx`): a context provided by `DocumentEditor` exposing `requestAiEdit({ text, kind, onApply })`. `DocumentEditor` reuses its existing `AiEditPanel`, `runAiEdit` and target state; when a bridge request supplies `onApply`, the applied text is routed to that callback instead of the document range replacement. No change to the existing document selection path.
- **Cell rendering**: `SmartTable.tsx` `cellDisplay` swaps raw text output for `renderMathInline(normalizeMathSource(raw))` from `src/lib/notebook/mathRender.ts` / `mathNormalize.ts` — the exact renderer AI Edit previews with. `=` formula cells keep their evaluator behaviour, rendering the computed value through the same renderer.
- **Cell selection + toolbar** (new `SmartTableCellToolbar` in the smarttable folder): while a cell is in edit mode the inline editor stays a real text input; on `select`/focus the toolbar anchors above the cell with Copy, Cut, Delete, Duplicate, Comment and AI Edit. AI Edit captures `{ text, selStart, selEnd }`, classifies the kind via the existing `detectSelectionKind` heuristics for a plain string, and calls `requestAiEdit`. The apply callback splices the proposed text into the cell string at the captured offsets and writes back through the existing `writeCell`/`patch` path, so it lands in one editor transaction (undoable).
- **Header cells** use the same path as body cells.
- **Generation**: `smartTableNode` in `src/lib/lessonnotes/ai/materializeDirectives.ts` maps every header and cell through `sanitizePresentation` + `normalizeMathSource` before building the node attrs.
- No database or schema changes; no change to the 2D/3D diagram, graph or other assets.

## Out of scope

Turning each cell into a nested TipTap document (true inline node-level editing inside cells) is a much larger rewrite of the table node and its persistence format. This plan achieves the same teacher-visible workflow without that migration; if per-cell rich nodes (inline images, embedded assets in cells) are needed later, that becomes a separate phase.
