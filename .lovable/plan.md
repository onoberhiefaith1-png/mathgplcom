## Goal

Make every arithmetic asset classroom-ready: empty by default, highly visible, with basic row/column controls under the asset and advanced settings in a collapsible right-hand Properties Panel.

## 1. Properties Panel — collapsible drag/toggle

File: `src/components/lessonnotes/PropertiesPanel.tsx`

- Keep the current fold/expand button but move it onto a visible **vertical handle strip** on the panel's left edge, so it reads as a drag/close bar. Icon rotates (« expanded / » collapsed).
- Panel state persists across selections (no auto re-open on every reselect once user has folded it).
- When collapsed, show a slim 32px rail with the settings icon + "Settings" label — click anywhere on the rail to reopen.
- Header still shows asset title + close button.

## 2. Global rules applied to every arithmetic asset

- **Remove all seeded placeholder values.** Every asset opens empty (no `"45"`, `"2456"`, `"48 60"`, `"3648"`, etc. in `normalize()`).
- **Bump default visibility**: heading colour → `#0f172a`, digit colour → `#0f172a`, heading font ≥ 13px, digit font ≥ 20px, row height ≥ 44px, divider thickness ≥ 3px, header underline 3px.
- **Inline bottom toolbar** rendered only when the asset is selected, positioned directly under the asset (not top). Contains only the primitives needed for that asset (Add Row / Add Col / Delete Row / Delete Col). Everything else stays in the right-hand panel. Reused shared component `AssetBottomToolbar` in `src/components/lessonnotes/panel/AssetBottomToolbar.tsx`.

## 3. Per-asset changes

### PlaceValueChart
- Default headers: `["H", "T", "U"]`, all values empty.
- `Add column` inserts one column on the LEFT using ordered names `T, H, Th, TTh, HTh, M, TM, HM, B` (skipping any already present, walking down the list).
- `Delete column` removes the LEFTMOST non-U column. U is locked.
- No visible vertical borders (`showGuides` default false, remove `borderLeft` when guides off — already true, but also remove `borderCollapse`/table default lines). Header underline stays as the only visible rule.
- Bottom toolbar: `+ Column`, `− Column`, `+ Row`, `− Row` (support multiple invisible rows — extend `values` to `string[][]`).

### LongDivision
- Defaults: `divisor: ""`, `dividend: ""`, `quotient: ""`, `workingRows: []`.
- Bottom toolbar: `+ Working Step`, `− Working Step`.
- Each "step" adds a pair of rows: row 1 (product, no line), row 2 (subtraction, gets minus sign + top border automatically). Existing autoMinus/autoLine logic already covers this; just make one press add two rows.

### DivisionLadder
- Defaults: `divisors: [""]`, `values: [[""], [""]]`, `cols: 1`. Only the single vertical divider visible.
- Bottom toolbar: `+ Row`, `− Row`, `+ Column`, `− Column`.
- Remove the top-border "result row" styling; treat every row uniformly (invisible).

### BaseConversion
- Defaults: `base: ""`, `rows: [{q:"", r:""}]`.
- Bottom toolbar: `+ Row`, `− Row`. Keep the invisible R column already implemented.

### FractionWall
- Defaults: `rows: []` (empty until teacher adds).
- Bottom toolbar: `+ Row`, `− Row`. Denominator/colour still in right panel.

### Base10Blocks
- Default `value: ""`. When empty, render nothing (no zero blocks).
- No bottom toolbar needed; number input is in right panel.

### AbacusAsset
- Default digits all 0 (already is), no `showValue` numeric until teacher acts. Leave otherwise; only remove any preset examples if present.

### FractionStrip
- If a `FractionStrip` component exists under arithmetic, apply same rule: start with one empty strip, denominator/numerator configured only via right panel. (Confirm during implementation; skip if the component isn't present.)

## 4. Technical notes

- New file `src/components/lessonnotes/panel/AssetBottomToolbar.tsx` exporting `<AssetBottomToolbar>` with pill buttons using existing design tokens (`bg-background`, `border-border`, `text-foreground`), rendered inside each asset's root when `selected` is true, positioned `mt-2 flex gap-1 justify-center`.
- PlaceValueChart values become `string[][]` (`rows × cols`); migration: if `values` is `string[]`, wrap as `[values]`.
- PropertiesPanel: replace auto-expand-on-select `useEffect` with a persistent user preference held in component state; only auto-expand when there was no prior selection.
- No changes to `useRegisterAssetEditor` API.
- Typecheck after edits; Playwright spot-check PlaceValueChart (add column, add row, fold panel) and LongDivision (add step) to verify.

## Out of scope

- Non-arithmetic assets (geometry, living diagrams, smart table) — untouched.
- Persisting panel fold state across page reloads.
