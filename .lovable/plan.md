## Refine Add Angle & Add Area annotation settings

Existing workflows for Add Angle and Add Area stay intact. This adds two new pre-placement options to the left toolbar and a cleanup pass on completion.

### 1. Data model — `GeometryModeContext.tsx`

Extend `AnnotationDraft`:
- `keepLabels?: boolean` (default `true`) — applies to Add Angle and Add Area.
- `fillColor?: string`, `fillOpacity?: number` — applies to Add Area (defaults: current scene fill defaults).

Seed these defaults when a tool is activated (Add Angle / Add Area). Do not alter existing fields.

### 2. Toolbox UI — `GeometryToolbox.tsx`

Inside the annotation panel, add controls under the value input:

**Add Angle** (after "Enter Angle Value"):
- "Point Labels" radio group: `With Label` / `Without Label`.

**Add Area** (after the existing Straight / Curve toggle, then above the tracing hint):
- "Fill Colour" row: color swatch + opacity slider (0–1). Wire to `annotationDraft.fillColor` / `fillOpacity`.
- "Point Labels" radio group: `With Label` / `Without Label`.

Styling matches the current annotation panel (compact chips / radio buttons already used in the toolbox).

### 3. Canvas behavior — `GeometryCanvas.tsx`

Add Area:
- When creating the region, apply `fillColor` / `fillOpacity` from the draft (instead of scene defaults) so the teacher's pre-chosen appearance is used.
- Track the temporary tracing point ids created during this Area session in a local ref/list.

Add Angle:
- Track the temporary vertex/arm point ids created during this Angle session.

On completion of either tool (region finalized / angle finalized) **or** when the tool changes / annotation draft clears:
- If `keepLabels === false`, delete the tracked temporary points (and their auto-labels) via existing scene ops. The angle/area object itself is untouched.
- If `keepLabels === true`, leave points and labels in place (current behavior).

Only points that were **created by this annotation session** are removed — pre-existing points that the user clicked on are never deleted.

### 4. No changes to

- Existing Add Angle / Add Area workflows, hints, keyboard shortcuts.
- Right-panel property editing for finalized angles / areas.
- Add Text / Add Distance tools.

### Files touched

- `src/components/lessonnotes/geometry-editor/GeometryModeContext.tsx`
- `src/components/lessonnotes/geometry-editor/GeometryToolbox.tsx`
- `src/components/lessonnotes/geometry-editor/GeometryCanvas.tsx`
