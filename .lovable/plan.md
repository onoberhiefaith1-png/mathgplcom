## Long Division — Column-Aligned Digit Cells

Refactor `LongDivision.tsx` so the dividend, quotient, and every working row use a shared invisible digit-column grid. Each digit occupies exactly one column; typing snaps digits into cells; working rows auto-align to the dividend.

### Data model (attrs)

Replace free-text `dividend`, `quotient`, `workingRows: string[]` with column-indexed arrays:

- `dividendDigits: string[]` — one entry per column (source of truth for column count)
- `quotientDigits: string[]` — same length as dividendDigits
- `divisor: string` — stays free text (sits outside the grid, right of the bracket's left side)
- `workingRows: string[][]` — each row is `string[]` sized to `dividendDigits.length`
- keep `showWorking`, `autoMinus`, `autoLine`, `lineThickness`, `rowHeight`

Column count = `dividendDigits.length` (min 1). Grows automatically as the teacher types past the current width; shrinks when trailing columns become empty (only via backspace at the tail, never mid-row).

### Layout

One CSS grid per horizontal line, all sharing:

```
gridTemplateColumns: `repeat(${nCols}, var(--ld-col))`
```

where `--ld-col` is a fixed width (e.g. `1.1ch` at the current font size) — this is what guarantees column alignment across rows without visible gridlines.

Structure top-to-bottom:

1. Quotient row — grid of `nCols` cells above the bar.
2. Bracket row — divisor (free text, right-aligned before `)`) + `)` + bar (top border) + dividend grid of `nCols` cells.
3. For each working row: an offset grid of `nCols` cells; optional leading `−` in a fixed-width gutter column; optional top border for subtraction rows.

The `−` sign and the divisor/`)` live in fixed side gutters (`grid-template-columns: [gutter] auto [gutter] auto [cells] repeat(nCols, var(--ld-col))`) so cell columns line up exactly across quotient, dividend, and every working row.

### Digit cell component

New tiny `DigitCell` (local to the file):

- Renders a single-character input styled as plain text (no border, transparent bg, centered, width = `var(--ld-col)`).
- `maxLength=1`; accepts digits, `.`, `,`, or blank.
- Key handling:
  - digit → write to this column, focus next column (create column if this is the dividend and we're at the last col).
  - Backspace on empty cell → focus previous column; Backspace on filled cell → clear this column only.
  - ArrowLeft/ArrowRight → move focus; Space → move to next column without writing (matches existing LTR behavior).
- Focus is tracked by `data-ld-row` + `data-ld-col` attributes so keyboard nav can find neighbors via `querySelector`.

### Column growth / shrink rules

- Dividend row: typing in the last column appends a new column (all rows extended with `""`).
- Backspace clearing the last dividend column when all rows' last column are empty → drop that column from every row and from quotient.
- Working rows never change column count on their own.

### Toolbar

Keep existing `+ / −` working-step buttons. New rows are created as `Array(nCols).fill("")`.

### Migration

On mount, if `attrs.dividend` (string) exists but `dividendDigits` doesn't, split the string into chars → `dividendDigits`. Same for `quotient`. For legacy `workingRows: string[]`, map each string to a right-aligned char array padded to `nCols`. Persist the migrated shape via `onChange` once (guarded by ref to avoid loops).

### Files

- `src/components/lessonnotes/extensions/visuals/arithmetic/LongDivision.tsx` — rewrite render + attrs handling; add `DigitCell` and keyboard nav.
- No changes to `src/lib/division.ts` (that engine is for the guided-solver flow, not this teacher-editable asset).
- No changes to other assets or the properties panel.

### Out of scope

- Auto-computing quotient/product/remainder (still teacher-typed).
- Visible gridlines.
- Any change to LCM/HCF ladder or other tabular assets.
