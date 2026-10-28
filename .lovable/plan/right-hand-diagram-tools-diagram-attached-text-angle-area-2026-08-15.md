# Right-hand Diagram Tools — diagram-attached Text, Angle, Area

The right-hand tools stay separate from the left-side general Text / Angle / Area tools (`addText`, `addAngle`, `addArea`) — those are untouched. Only the diagram-attached tools (`smartText`, `smartAngle`, `smartArea`) and the properties they expose change. Area already works and keeps its current enclosed-region logic; it only gains colour/size properties on selection.

## Current state (verified in code)

- `smartText` already attaches to a clicked line, but it writes into the segment's `label` field, which collides with the segment name, and it also ends up placing floating labels on blank paper. Segment labels have no colour or size fields in the scene model (only `distanceColor` / `distanceFontSize` exist for the distance chip), so no text properties can be shown.
- `smartAngle` requires two line picks and does nothing at all after the first pick; if the two lines don't share a point it just posts a notice. There is no single-line inference from existing intersections.
- Angles have `valueColor` / `valueFontSize` for the text chip but no colour or size for the arc marker itself.
- The workflow card asks for an explicit "Enter" submit before the pick step.

## Workflow changes

```text
Add Text  → type value → "Select line" → click line → text placed → workflow ends
Add Angle → type value → "Select line" → click line → internal angle appears
            → workflow stays open for adjustment until another tool/selection
Add Area  → "Select enclosed region" → region fills → area properties (unchanged logic)
```

1. **No Enter step.** Typing a value advances the draft to the `pick` step automatically (debounced on change); the panel line changes from the input to `Select line`. Enter still works but is not required, and the input stays visible so the value can be corrected before the pick.

2. **Add Text (`smartText`)** — the click must land on a line. Text is written to a new `lineText` field on the segment (with `lineTextColor`, `lineTextFontSize`, `lineTextOffset`), so the existing `label` name and `distance` measurement both survive: a line can carry a name, a distance and an added `47 cm` at once. The chip renders at the midpoint, rotated with the line, and is draggable via `lineTextOffset` using the same drag mechanism as `segmentLabel`/`segmentDistance`. Clicking a point or blank paper no longer creates a floating label — the panel says "Select a line" and keeps the workflow armed. On placement the tool returns to Select and the new text is selected so its properties show.

3. **Add Angle (`smartAngle`)** — one line pick. From the picked line, find candidate vertices: its two endpoints, ordered by how many other lines share them. Pick the endpoint with at least one other incident line and use the neighbouring line at that vertex that gives the smallest (internal) angle as the second arm. Create the angle with `reflex: false`. If the line touches nothing, the panel says the line has no intersection yet and keeps the workflow armed. If both endpoints qualify, the click position decides: the endpoint nearer the click wins.

4. **Angle stays adjustable.** After creation the tool stays on `smartAngle` with the new angle selected, so the angle properties (below) plus the existing internal/reflex toggle and draggable value chip are usable immediately. Any other tool button, or selecting another object, clears the workflow — no Complete button.

5. **Add Area (`smartArea`)** — unchanged pick/cycle logic (`cycleFromSegments` + `addRegion`). Only the panel hint wording and the post-creation selection are touched, so the region's properties open right away.

## Properties (contextual, one object at a time)

- **Text selected** (`lineText` chip): colour + size, delete, still draggable.
- **Angle selected**: value, marker colour, marker size (arc radius), value colour/size, internal/reflex toggle. Adds `arcRadius` and `markerColor` to the angle model.
- **Area selected**: fill colour + opacity (existing `RegionPanel` fields, surfaced immediately on selection).
- Point / line / distance / label panels and all existing controls (colour, size, hide, dashed, arrows, equal and parallel marks, relationships, undo/redo) stay exactly as they are.

## Panel shell

Default (nothing selected, no workflow): `ADD — Text | Angle | Area` and `HISTORY — Undo | Redo`, plus the existing Erase / Select row. Workflow card replaces the grid while a tool runs. When an object is selected, the compact Add row plus that object's properties only.

## Technical notes

- `src/lib/geometry/scene.ts`: add `lineText`, `lineTextColor`, `lineTextFontSize`, `lineTextOffset` to `GeoSegment`; add `arcRadius`, `markerColor` to `GeoAngle`. Additive optional fields, so existing saved scenes keep working.
- `GeometryCanvas.tsx`: render + hit-test the new `lineText` chip (new hit kind `segmentText`), add its drag branch alongside `segmentLabel`; rewrite the `smartText` and `smartAngle` cases; angle arc rendering reads `arcRadius`/`markerColor`.
- Vertex/arm inference for the single-line angle uses the existing incidence data in the scene (segments sharing a point) — no new geometry library.
- `GeometryModeContext.tsx`: draft advances to `step: "pick"` without the confirm button; `smartAngle` no longer resets to Select after creation.
- `DiagramToolsPanel.tsx`: drop the Enter button, add the History row, update hints ("Select line").
- `SelectionInspector.tsx`: new `SegmentTextPanel`, extend `AngleEditPanel` with marker colour/size, route `segmentText` selections.
- No database, AI, or left-toolbox changes.
