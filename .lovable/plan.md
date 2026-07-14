## Universal Asset Editing Rule (to be enforced everywhere)

Two non-negotiable conditions for every editable asset in the app:

1. **Settings live in the Right-Hand Properties Panel only.**
   - The foldable right-hand panel (already implemented for 3D solids, triangle, and other geometry assets via `useRegisterAssetEditor` + `PropertiesPanel`) is the single home for all edit controls.
   - No floating popovers, no inline "Edit" chips, no bottom toolbars, no settings dialogs anywhere else.
   - Clicking an asset (or its selection frame) opens/focuses the right panel with that asset's controls.

2. **Assets and their content must be visible by default.**
   - Default text colour, size, stroke, and contrast must be readable on the page background without the user changing anything.
   - Grid lines, borders, and cell text in tables must have sufficient contrast (dark ink on light paper, not faint greys).
   - Previews in the asset library must clearly show the asset.

## What I will change

### A. Save the rule as a Core project memory
Add to `mem://index.md` Core so every future edit respects it, and drop a `mem://design/universal-editing-rule` file with the full text.

### B. Fix Smart Table to comply (current violation)
- Remove the bottom inline toolbar (Rows/Cols switch, +/−, Edit button) that was just re-added.
- Move all Smart Table controls back into the right-hand Properties Panel via `useRegisterAssetEditor`, matching the pattern used by the 3D solid / triangle assets.
- Panel contents: Add/Remove Row (+ / −), Add/Remove Column (+ / −), cell padding, border thickness, border colour, text size, alignment, bold headers, striped rows, show gridlines, reset style.
- Ensure the panel opens automatically on selection and folds away when deselected (same behaviour as geometry assets).
- Fix default visibility: darker default border colour, darker default text colour, minimum readable font size so table content is legible immediately after insertion.

### C. Audit every other asset for the same two conditions
Sweep these files and remove any remaining floating/inline edit UI, routing all controls to the right panel via `useRegisterAssetEditor`:
- `extensions/visuals/arithmetic/*` (PlaceValueChart, LongDivision, DivisionLadder, BaseConversion, FractionWall, Base10Blocks, Abacus)
- `extensions/visuals/smarttable/SmartTable`
- `extensions/visuals/living/*` (SelectionFrame must not render an `onEdit` chip anywhere)
- `extensions/GeometryDiagram` and `treeEngine/TreeEngineCanvas`
- Any other asset with a local settings popover

For each: verify default rendering is high-contrast and legible without the user opening the panel.

### D. Verification
- Typecheck.
- Playwright: insert Smart Table, confirm no bottom toolbar, confirm right panel shows controls, confirm text/grid are visible by default. Repeat spot-check on one geometry and one arithmetic asset.

## Technical notes
- Reuse existing `useRegisterAssetEditor` hook and `PanelGroup`/`PanelRow`/`PanelNumber`/`PanelToggle`/`PanelColor`/`PanelButton` primitives — no new panel infrastructure needed.
- Selection wiring already exists via `AssetSelectionProvider`; each asset just needs to call the hook with its editor JSX.
- Default token adjustments stay in the component (not `index.css`) so we don't disturb global theme.
