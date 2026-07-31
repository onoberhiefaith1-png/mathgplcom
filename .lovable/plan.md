# Smart Structures stay Smart Structures — never a spreadsheet

Right now a highlighted long division or prime-factorisation ladder is decomposed into a grid and then **drawn** with the Smart Table renderer, so the teacher's bracket, rules, ladder divider and alignment are replaced by table cells. The grid model itself is fine — it is only ever an address book (which cell a Floating Number belongs to). What must change is the rendering: the structure is rendered by its own asset, exactly as the teacher drew it, with editable cells sitting on top.

## What changes for you

- Highlighting a long division shows the real long division layout in the workspace and on the Smartboard: bracket, horizontal rules, minus signs, digit alignment — unchanged.
- A prime-factorisation / division ladder keeps its vertical divider, its ladder rows and its `R` labels.
- Place-value charts keep their headings, base conversion keeps its divider and `R` column.
- Floating Numbers are unchanged in behaviour: one per structure row (or column), and placing one fills the cells **inside** the preserved structure.
- Retained values render as read-only ink in place; blanks are the only thing students can type into.
- Nothing about the structure is regenerated, re-laid out, or converted into headers/borders at any point.

## Technical plan

### 1. Static layer = the asset itself, rendered read-only
New `src/components/structures/StructureStage.tsx`:

- Takes `{ objId, structureId, attrs, values, editableKeys, retainedKeys, activeKey, onCellChange }`.
- Renders the matching asset component (`LongDivision`, `DivisionLadder`, `BaseConversion`, `PlaceValueChart`) with the teacher's original `attrs`, so every line, bracket, divider, heading, spacing and size prop is preserved verbatim.
- Adds a `board` presentation mode to those four components (new optional prop, default off) that: hides authoring chrome (`AssetBottomToolbar`, ± hover buttons, `useRegisterAssetEditor` panel registration), and routes each value cell through a render callback so the stage can substitute a `SmartCell` (editable), read-only ink (retained), or a blank.
- Cell identity comes from the existing `r:c` keys produced by `structureGrid.ts`; each asset maps its own value slots to those keys through a small `cellKeyFor(...)` helper local to the asset, so structure cells (bracket gutter, minus column, `R` heading) are simply never given a key.

### 2. Workspace and Smartboard use the stage, not the table renderer
- `src/components/floating/TableWorkspace.tsx`: when `isStructureObject(obj)`, render `StructureStage` in place of the grid table for the preview/selection surface. Orientation, Generate and Retention controls stay exactly as they are; clicking a cell in the stage selects the same `r:c` key the table used.
- `src/components/smartboard/TableActivityStage.tsx`: for a structure-backed group, expand into `StructureStage` instead of the `<table>` markup. Collapsed state, `onMeasure` height reporting, one-lesson-line behaviour, T-series tag and neutral (no ticks) rule are untouched.

### 3. Grid becomes address-only for structures
- `src/lib/floating/tableGrid.ts` / `structureGrid.ts`: keep the adapters, but carry `structureId` and the original `attrs` on the grid so downstream renderers can rebuild the static layer. Add `headers`/borders being ignored for structures (documented) so no code path draws them.
- `src/lib/lessonnotes/floatingCompile.ts`: extend `FloatingTableRef.grid` with `structureId` and `attrs` so the Smartboard can render the preserved structure without going back to the lesson note.
- `src/lib/smartboard/tableActivity.ts`: pass those two fields through `TableGroup`; static cells continue to merge into `retained`.

### 4. Universality
`structureGrid.ts` keeps one registry (`STRUCTURE_IDS`) mapping asset id → adapter. Column addition, long multiplication, synthetic division, factor trees etc. join by adding their asset id plus a `cellKeyFor` mapping — no renderer changes, because the static layer is always the asset itself.

No migration: structures are already persisted as objects on `content_json`; `structureId` and `attrs` are read from that snapshot.
