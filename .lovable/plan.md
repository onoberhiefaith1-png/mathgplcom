# Smart Table — Cell Calculator & Summation (Σ)

Applies to the Smart table asset from the Asset Library (Tables → Statistical). No other asset, toolbar, or table changes.

## 1. Every cell is a mini calculator

Type an expression in a cell and press Enter — the cell stores the answer.

- `5 + 5` → `10`, `25 × 4` → `100`, `48 ÷ 6` → `8`, `3²` → `9`, `√81` → `9`
- Nothing is calculated while typing; Enter only.
- Plain text (e.g. `Frequency`) and plain numbers stay exactly as typed.
- If the expression can't be solved, the typed text is kept as-is (no error marker), so notes never break.
- Escape still cancels the edit.

The existing safe expression engine already handles `+ − × ÷ * / ^ ( ) √ ² ³` and unary minus, so no new maths engine is needed — it just gets applied on Enter instead of only for cells starting with `=`. Existing `=expression` cells keep working.

## 2. Σ Summation tool

A Σ button joins the Row / Column / − / + / Edit controls that appear under a selected table. Clicking it shows two options:

- **Sum Row**
- **Sum Column**

After choosing one, the table enters summation mode (a short hint appears, e.g. "Click the total cell"):

- **Sum Row** — click a cell; every numeric cell to its left in that row is added and the total is written into the clicked cell.
- **Sum Column** — click a cell; every numeric cell above it in that column is added and the total is written into the clicked cell.

Mode then exits automatically. Escape or clicking Σ again cancels it.

```text
A     B     C     D            A
15    20    10   [click] → 45  15
                               25
                               10
                              [click] → 50
```

Rules: only numeric cells count (a cell holding a calculated answer counts as its number), empty and text cells are ignored, header row is never included in a column sum. Re-running Σ on the same cell recalculates and overwrites the old total, so totals can be refreshed after edits.

## Technical notes

- `src/components/lessonnotes/extensions/visuals/smarttable/evaluator.ts` — add a small `tryEvaluate(raw)` helper returning the formatted number when the string is a solvable expression (and is not just a plain number/text), else null.
- `src/components/lessonnotes/extensions/visuals/smarttable/SmartTable.tsx`:
  - `finishEdit` runs `tryEvaluate` on the buffer before writing the cell/header value (headers keep raw text).
  - New `sumMode: "row" | "col" | null` state; when set, a cell click writes the sum instead of opening the editor.
  - `sumRow(r, c)` / `sumCol(r, c)` read `cells`, parse numeric values with the existing evaluator, and patch the target cell.
  - Σ control added to the existing selected-table control strip with a small two-item popover; mode hint rendered above the table.
- No database, no schema, no changes to other assets or the Lesson Notes ribbon.
