# Smart Table as an inline Smartboard object

Today the Smart Table renders as a centred floating card/panel over the board (`TableActivityStage` is absolutely positioned at `top: 96` with a shadow and blur, sitting above the writing surface). It also draws green ticks inside cells while the student types.

Two changes:

1. The table becomes a real object on the writing surface, occupying its own lesson line in the lesson flow, expandable/collapsible, with an auto-hiding toolbar underneath.
2. All correctness feedback leaves the board. Validation keeps running, but silently, feeding the Reasoning/Assessment layer only.

## 1. Inline placement

- The table renders inside the continuous writing canvas, anchored to the board row that owns the table's anchor lesson line (same coordinate system used for lesson beats: `rowTopPx(row)` inside `WritingSurface`, left-aligned to the writing margin, full writable width).
- Its measured height is registered through the existing push-down channel (the same keyed overflow map beats use), so every row below the table moves down by exactly the table's height and moves back up when it collapses. The table therefore never covers other lesson content.
- No modal, no overlay, no backdrop blur, no drop shadow: a plain bordered object on the board surface, matching board ink colours in light and dark.

## 2. The teacher's original table

- The grid already travels with the floating line reference (rows, cols, headers, cell values, retained keys, orientation, label). Rendering keeps using that object as the single source of truth — nothing is recreated.
- Preserve what the reference carries: dimensions, headings, retained cells, cell values/formulas, and any width/height/colour/merge information present on the grid. Where a property does not yet exist on the reference, the table renders neutrally rather than inventing a value (a follow-up can widen the reference if merges/colours are needed downstream).

## 3. Collapsed and expanded

- Collapsed: a single line showing `▶ <Table label>` in board ink, occupying one lesson line only.
- Expanded: `▼ <Table label>` plus the full interactive grid below it.
- Toggling is free at any time; expand/collapse state is remembered per table for the session, alongside the existing per-cell entries.

## 4/5/6. Toolbar with auto-hide and auto-show

- A small toolbar sits *underneath* the table (inside the object, not floating): `Expand`/`Collapse`, `Delete`, and room for Copy, Duplicate, AI Edit, Settings, Export later.
- Visible on hover near the table, pointer movement over it, click/tap inside the table, or hover over its bottom edge; fades out after ~5 seconds of no interaction (reusing the project's `useAutoHide` hook with a 5000 ms window).
- No reveal button. The table itself never hides.

## 7/9/10/11/12. Behaviour that stays

- Cells stay live: manual editing, Enter-solves-arithmetic, Σ summation, expressions — unchanged.
- Clicking any editable cell resolves its row (row-oriented) or column (column-oriented) and activates that Floating Number line; Floating Numbers, Present and the active row/column stay in one state, driven by the board as today.
- Assessment continues to read the active track (`Expected Row 3` / `Expected Column 2`, complete/incomplete) — but it is displayed by the assessment/reasoning surfaces, not printed inside the table header.
- Retained cells render exactly as prepared, read-only; every other cell is student-editable.
- Internal floating lines belonging to the table remain internal: the group still collapses to one lesson step, so they never appear as separate lesson lines.

## 13. Delete

- `Delete` on the toolbar removes only that Smart Table object from the lesson: its member floating lines are dropped from the active reservoir view, its cell entries and expand state are cleared, and the active line falls to the first line after the table. All other lesson content is untouched.

## 2b. Validation moves off the board

- Remove the in-cell green tick and any correct/incorrect styling, live marking, score text and the `Complete/Incomplete` badge from the table object. Highlighting of the *active* row/column stays — that is navigation, not marking.
- Keep `isCellCorrect` / `isLineComplete` / `isGroupComplete` exactly as they are. Their output flows into a hidden validation state (per cell: expected, given, status; per track: complete/incomplete) held on the board next to the existing table entries.
- The Reasoning/Assessment panels read that hidden state and remain the only place feedback appears ("Row 2 is complete.", "Check the third value.", "Expected Row 3 — incomplete").
- Auto-advance keeps using the hidden state, so completing a row still moves the sensor on and completing the group still advances the lesson — silently.

## Technical notes

- `src/components/smartboard/TableActivityStage.tsx`: drop the fixed/absolute overlay wrapper, shadow and blur; become a flow object with header row (chevron + label), grid, and auto-hiding footer toolbar; remove tick/complete indicators; add `onDelete`, `collapsed`, and pointer-activity handling via `useAutoHide(5000)`.
- `src/components/smartboard/PresentationView.tsx`: render the stage inside `WritingSurface` at `rowTopPx(row)` for the group's anchor line instead of at the board root; register its height in the keyed overflow map so rows below shift; add per-table expand state, hidden validation state derived from `tableActivity` helpers, and the delete action.
- `src/lib/smartboard/tableActivity.ts`: unchanged logic; add a small derivation helper that returns the hidden validation snapshot (per-cell status + per-track completion) for the reasoning layer.
