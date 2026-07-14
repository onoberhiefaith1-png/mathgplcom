## Goal

Make every editable asset in the lesson-notes editor edit through a single, universal right-hand Properties Panel, and redesign the arithmetic assets (Place Value, Long Division, Division Ladder, Base Conversion, Fraction Strip/Wall, Base-10 Blocks, Abacus) so they are clearly visible in the library and behave to the spec below.

This is a large, multi-part change. Because it touches almost every asset type, I'll deliver it in three ordered phases so you can review after each one.

---

## Phase 1 — Universal Properties Panel infrastructure

**New file: `src/components/lessonnotes/PropertiesPanel.tsx`**
A single right-hand docked panel (sibling of the editor column) that renders the property editor for the currently-selected asset. It replaces every existing floating/absolute edit widget.

- Uses a registry pattern: `registerPropertiesEditor(assetType, Editor)` — one entry per asset (smarttable, placeValueChart, longDivision, divisionLadder, baseConversion, fractionStrip, fractionWall, base10Blocks, abacusManipulative, geometry, tree, org, flowchart, venn, circle, solid, line, matrix, …).
- Reads current selection from a new `useAssetSelection()` store (Zustand-style context) that every asset writes into on click.
- Shows a placeholder ("Select an asset to edit its properties") when nothing is selected.
- Docks to the right of `DocumentEditor`, matching the existing GeometryAiPanel column width; collapsible.

**Selection wiring**
- Add `onSelect(attrs, patch)` hookup at each asset root. Clicking an asset (or its `⚙ Edit` chip) sets it as the active selection instead of opening a local popup.
- Remove the in-place `<div className="absolute -top-6 …">` chip toolbars from: `PlaceValueChart`, `LongDivision`, `DivisionLadder`, `BaseConversion`, `FractionWall`, `FractionStrip`, `Base10Blocks`, `SmartTable`, and the per-engine node overlays (Tree/Org/Flowchart/Venn/Circle/Solid/Line). Their controls move into the panel editor.
- Keep the manual `⚙ Edit` chip on the selection frame — but it now just activates the right-hand panel, no popover.

**Existing engine panels (`TreeEnginePanel`, `OrgEnginePanel`, `FlowchartEnginePanel`, `VennEnginePanel`, `CircleEnginePanel`, `SolidEnginePanel`, `LineEnginePanel`)**
- Convert from `createPortal` floating panels into plain editor components registered in the properties-panel registry. Same fields, same handlers — just rendered inside the docked panel instead of a portal.

**GeometryAiPanel**
- Stays where it is (AI edit panel, separate concern). Not touched.

---

## Phase 2 — Arithmetic asset redesigns

Each asset is rewritten to the spec, and its property editor lives only in the right-hand panel.

**Place Value Chart** (`PlaceValueChart.tsx`)
- Always starts with `U`. Columns added/removed only from the left. `U` can never be removed.
- No visible vertical grid lines; invisible alignment guides keep digits centred under headings.
- Panel: Add Place Value, Remove Left Column, Font Size, Heading Size, Column Width, Row Height, Show Alignment Guides, Colours.

**Long Division** (`LongDivision.tsx`)
- Natural writing flow. Every two working rows auto-inserts a subtraction line + minus sign.
- Panel: Add Working Row, Delete Last Row, Line Thickness, Row Height, Auto Minus (toggle), Auto Horizontal Line (toggle).

**Division Ladder** (`DivisionLadder.tsx`)
- One visible vertical divider; rest uses invisible alignment columns.
- Panel: Add/Delete Row, Add/Remove Number Column, Row Height, Column Width, Divider Thickness, Font Size.

**Base Conversion** (`BaseConversion.tsx`)
- Remove the `→` arrow entirely. Use text `R` for remainder, right-aligned in its own invisible column.
- Vertical divider auto-extends as rows are added.
- Panel: Add/Delete Row, Divider Thickness, Column Width, Row Height, Font Size.

**Fraction Strip** (`FractionStrip.tsx`)
- Single strip with: Number of Equal Parts, Highlight Numerator, Colour, Border, Show Fraction Label, Animate Equal Partition, Show Equivalent Fraction.

**Fraction Wall** (`FractionWall.tsx`)
- Panel: Number of Rows, Maximum Denominator, Highlight Fraction, Compare Fractions, Colour Theme.

**Base-10 Blocks** (`Base10Blocks.tsx`)
- Teacher types a number (e.g. `2456`); the component auto-generates the correct count of Thousands/Hundreds/Tens/Units.
- Panel: Labels (toggle), Colours, Stack Mode / Flat Mode toggle, Animate Regrouping.

**Abacus** (`AbacusAsset.tsx` wrapper)
- Panel: Number of Rods, Beads per Rod, Decimal Mode, Place Value Labels, Show Numeric Value, Reset, Animate Beads.
- The underlying game `Abacus` component gains the extra props it needs to support those settings (rods/beads/decimal).

---

## Phase 3 — Asset Library previews

In `src/lib/lessonnotes/assets/tables.ts` (and the library preview renderer) each arithmetic asset gets a dedicated preview instance sized to be clearly readable in the picker:

- Larger preview box, centred, min-height ~120px.
- Thicker strokes (2px on rules/dividers), higher-contrast text (`text-foreground`, not `text-foreground/60`).
- Representative attrs (e.g. Place Value shows `HTh TTh Th H T U / 4 8 3 7 5`; Long Division shows the sample `12 ) 3648` with one subtraction line).
- Same visual style used consistently across every arithmetic asset preview.

---

## Out of scope for this plan

- No backend/edge-function changes.
- No changes to AI panel behaviour, geometry sketch pipeline, or Smart Table architecture (only its edit surface moves into the shared panel).
- No changes to adventure/games/smartboard pages.

---

## Files touched (summary)

- **New:** `src/components/lessonnotes/PropertiesPanel.tsx`, `src/components/lessonnotes/propertiesRegistry.ts`, `src/hooks/useAssetSelection.ts`.
- **Edited:** `DocumentEditor.tsx` (mount panel + selection provider), all seven engine panels, all eight arithmetic assets, `SmartTable.tsx`, `SelectionFrame.tsx`, `tables.ts` previews, `index.css` (panel tokens already added).
- **Removed:** in-place absolute chip toolbars inside each asset.

Ready to build in the order Phase 1 → 2 → 3.
