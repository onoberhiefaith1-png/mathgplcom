# Smart Structures — one model for every mathematical layout

Generalise the Smart Table workspace into a **Smart Structure** system: every layout (long division, prime-factorisation / division ladder, place-value chart, base conversion, column addition, long multiplication) is split into

1. **Static structure** — teacher-designed, retained forever (division bracket, horizontal rules, minus signs, vertical divider, ladder, R labels, borders, spacing).
2. **Editable cells** — the only things that become Floating Numbers.

The AI never rebuilds a structure; it duplicates the teacher's template and fills the editable cells.

## What changes for you

- Highlighting a long division or a prime-factorisation ladder now behaves exactly like highlighting a Smart Table: "Highlight this structure" produces Floating Numbers for the numbers only. The bracket, lines, minus signs and divider stay on the board permanently.
- Row orientation gives one Floating Number per level (`218` / `3, 654` / `6` / `054` …; `2, 16` / `2, 8, R0` …).
- Column orientation gives one Floating Number per column (divisor column, value column, remainder column).
- On the Smartboard the whole structure is **one lesson line** carrying its own T-series tags, same as tables today, and it stays until explicitly deleted.
- Retained cells (values the teacher pre-filled) render read-only; students only complete blanks.
- AI generation reuses the Asset Library template for these layouts instead of drawing ASCII or a fresh object.

## Technical plan

### 1. Structure → grid adapters (new)
`src/lib/floating/structureGrid.ts`

- `structureGridFromObject(obj)`: recognises structure assets by node/`attrs.family`/visual id and emits a `TableGrid` plus a **static mask** (`staticCells: string[]`, `staticGlyphs: Record<cellKey,string>`) describing cells that are pure structure.
- Adapters:
  - `longDivision` — `dividendDigits`, `quotientDigits`, `workingRows`, `divisor`. Quotient row, dividend row and each working row become grid rows; digit columns become grid columns. Divisor sits in a leading structural column; `autoMinus` / `autoLine` / bracket / rules are structure, never cells.
  - `divisionLadder` — `divisors[]` + `values[][]`; divider, alignment and `R` prefixes are structure, the divisor and each value are cells.
  - `placeValueChart`, `baseConversion` — same treatment (headers are structure, digits are cells).
- Blank-but-editable cells stay in the grid (so students can fill them); structural cells are excluded from every generated line.

### 2. Wire into the existing pipeline (no new pipeline)
- `src/lib/floating/tableGrid.ts`: `gridFromObject` falls back to `structureGridFromObject`; `generateTableLines` skips cells in the static mask so a line's values contain only editable content, and structure-only rows/columns produce no Floating Number.
- `src/lib/floating/solutionItems.ts`: treat structure assets as the `table` family (label "Structure") so the Highlighting Page and `presentation.ts` object filter accept them unchanged.
- `src/lib/smartboard/tableActivity.ts`: carry `staticCells` into `TableGroup` and merge them into `retained`, so completion checks and cell editing ignore structure cells. T-series numbering and `tagForLine` stay the single tag authority.
- `src/pages/FloatingNumbersPage.tsx`: the existing table workspace (orientation, Generate, Retention) now also opens for structure objects; the object-level "Highlight this table" control becomes "Highlight this table/structure".
- `TableWorkspace.tsx` / `TableActivityStage.tsx`: render structural cells as non-interactive glyphs (bracket, rules, minus, divider, `R`) and editable cells as `SmartCell`s.

### 3. AI generation rule
- `src/lib/lessonnotes/ai/toolManifest.ts`: expose the structure assets (`longDivision`, `divisionLadder`, `placeValueChart`, `baseConversion`) with their editable-cell contract.
- `supabase/functions/notebook-ai/workspaceStandard.ts`: add a Smart Structure clause — check the Asset Library template first, duplicate it, populate only editable cells, never draw brackets/ladders/lines as text; extend `workspaceViolations` to flag typed `)`-bracket division or `|`-ladder art and force the directive instead.

### 4. Data
No migration required: highlights already persist objects on `content_json`; the static mask is derived from attrs at read time, so existing notes upgrade automatically.
