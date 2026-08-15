# Right-hand Add Area — configuration first, then region pick

Scope is strictly the right-hand Diagram Tools panel. The left-hand geometry
toolbox stays exactly as it is.

## Left-hand panel: verified untouched

`GeometryToolbox.tsx` / `GeometryToolbar.tsx` (the left-side Text / Distance /
Angle / Area tools) have not been modified by the recent work — the recent diff
only touched `DiagramToolsPanel.tsx`, `GeometryCanvas.tsx`,
`SelectionInspector.tsx` and the `smartText`/`smartAngle`/`smartArea` branches of
`GeometryModeContext.tsx`. The left tools `addText`, `addDistance`, `addAngle`,
`addArea` keep their own separate cases in the canvas and their own draft seeding,
so there is nothing to restore and nothing in this task will go near them.

## What changes (right-hand Add Area only)

Today clicking Add Area jumps straight to picking lines with a hidden default
blue at 25% and no way to choose colour or density beforehand.

New behaviour:

```text
Add Area  →  config card appears under the Add row
             Area Colour   (swatches + custom)
             Density       (slider, transparency of the shading)
             Select Enclosed Region  (hint + count of lines picked)
          →  click boundary lines → cycle closes → region filled with the
             chosen colour + density → workflow card disappears, region stays
             selected so its properties are editable
```

1. The Add Area card in the right panel gains an **Area Colour** swatch row and a
   **Density** slider, both writing into the existing `fillColor` /
   `fillOpacity` fields of the right-hand draft. Changing them before the pick
   changes what the created region gets.
2. Region-picking logic is unchanged (`cycleFromSegments` + `addRegion`) — it
   already works, it just now reads the values the teacher chose.
3. On success the workflow closes and the panel returns to the plain
   `Add Text | Angle | Area` + History layout, with the new region selected so
   the existing region properties (fill colour, opacity, area value) are right
   there for further edits.
4. Starting any other right-hand tool, or pressing Cancel, clears the unfinished
   Area pick (picked lines dropped, no partial region left behind).

## Technical notes

- `DiagramToolsPanel.tsx`: add the colour + density controls to the `smartArea`
  branch of the workflow card; keep the existing hint/notice/cancel rows.
- `GeometryModeContext.tsx`: no change to any `add*` branch; the `smartArea`
  seed already carries `fillColor` / `fillOpacity`.
- `GeometryCanvas.tsx`: `smartArea` case already reads the draft values; only
  ensure pending picks are cleared when the tool changes away from `smartArea`.
- No changes to `GeometryToolbox.tsx`, `GeometryToolbar.tsx`, the left-hand
  `addText` / `addAngle` / `addArea` canvas cases, the scene model, the database
  or AI.
