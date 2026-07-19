# Annotation Tools — Value-First Workflow

Rework the four Annotation tools already docked in the left toolbar so the teacher enters the text/value **first** in an inline input on the toolbar, then places it on the canvas. Also add intelligent boundary detection to Add Area.

## 1. Left-toolbar inline input

When any of `addText`, `addDistance`, `addAngle` is activated, expand a small input area **inside the Annotation section** of `GeometryToolbox` (not on the canvas). It shows:

- A label ("Text", "Distance", "Angle")
- A text field auto-focused
- ✓ button (Enter) to confirm, ✗ (Esc) to cancel

Until the value is confirmed, canvas clicks do nothing. After confirm, the toolbar swaps to a small hint strip: *"Select a point to place the text."* / *"Select the first point."* / *"Select the first arm."* etc.

`addArea` skips the input step and goes straight into trace mode with hint *"Trace the enclosed region by selecting its boundary points."*

State lives in a new `annotationDraft` object in `useGeometryEditor` (`{ tool, value, step, collected: GeoId[] }`) so the canvas step machine reads a single source of truth.

## 2. Add Text

1. Enter text → Enter.
2. Hint: *Select a point to place the text.*
3. One click anywhere → create a floating `label` at the click point with the entered content (no inline-edit needed — value is already known).
4. Tool stays active; toolbar re-opens the text input for the next placement.

## 3. Add Distance

1. Enter value → Enter.
2. Two clicks (snap-or-create points). If a segment already exists between them, reuse it; otherwise create a lightweight *distance-only* annotation stored on a new floating measurement whose anchors are the two point ids and whose midpoint is computed live.
3. Set `distance = <value>` on the segment (or on the new measurement label).
4. Tool stays active.

Implementation note: reuse existing `GeoSegment.distance` when a segment exists so the label auto-drags with the segment. When no segment exists, create a `label` with `anchor: { a, b, kind: "midpoint" }` — requires a small extension to `GeoLabel` (optional `anchor` field; renderer computes position from the two points).

## 4. Add Angle

1. Enter value → Enter. If value normalises to `90`, remember `marker: "right"`.
2. Three clicks: arm1 → vertex → arm2 (each snaps or creates).
3. Create `GeoAngle { a, vertex, b, value, marker }`. No further inline edit.
4. Tool stays active.

## 5. Add Area — smart boundary tracing

Trace mode collects an ordered list of existing point ids. Between each consecutive pair, resolve the connecting geometry:

```text
for i in 0..N-1:
  p, q = collected[i], collected[i+1]  (last→first closes the loop)
  edge = findConnectingObject(scene, p, q)
    - GeoSegment with endpoints {p,q}       → straight edge
    - GeoArc where p,q both lie on the arc  → arc edge (use its center/r/angles)
    - GeoCircle where p,q both lie on it    → circular edge (shorter sweep by default)
    - GeoCurve where p,q are endpoints of a spline segment → follow curve
    - none                                   → fallback to straight edge (with warn hint)
```

Store the region as an extended shape:

```ts
interface GeoRegion {
  id; type: "region";
  boundary: GeoId[];                     // ordered point ids (existing)
  edges?: Array<                          // NEW: per-edge geometry ref
    | { kind: "segment"; ref: GeoId }
    | { kind: "arc"; ref: GeoId; sweep: "short" | "long" }
    | { kind: "circle"; ref: GeoId; sweep: "short" | "long" }
    | { kind: "curve"; ref: GeoId }
    | { kind: "straight" }               // fallback
  >;
  fill?; opacity?; area?;
}
```

Region renderer builds an SVG `path` from the edges array (M start; then A rx ry … for arc/circle sweeps; C … for curves; L … for straight). Falls back to straight polygon when `edges` is missing (existing regions still work).

Closing:
- Click near the first point, **or** Enter, **or** double-click closes the loop.
- Region is inserted into `scene.objects` as a permanent editable object (already the case) and auto-selected so the existing Area properties panel opens.

Helper additions in `src/lib/geometry/editor/`:
- `boundary.ts` (new) — `findConnectingObject(scene, p, q)`, `pointLiesOnArc`, `pointLiesOnCircle`, `curveEndpointsMatch`.
- `sceneOps.ts` — extend `addRegion` to accept `edges`.

## 6. Right-hand properties panels

Selecting each annotation opens the panel already routed by `SelectionInspector`, extended per the master prompt:

- **Text (`label`)**: Edit Text, Font Size, Colour, Bold, Italic, Rotation, Delete.
- **Distance**: Edit Value, Font Size, Colour, Position Offset (dx/dy), Rotation, Delete.
- **Angle**: Edit Value (auto-swaps marker to `right` when normalised to 90), Font Size, Colour, Marker Style (arc/double/right), Label Position (offset), Delete.
- **Area (region)**: Fill Colour, Opacity, Area Value, "+ Add / Edit text inside", Remove Fill, Delete Area — reuse existing `ClosedAreaPanel`/`FillablePanel`.

Add missing controls (Bold, Italic on `GeoLabel`; Rotation on distance/angle chips) as optional fields on the scene types; renderers ignore when absent.

## 7. Canvas hint bar

Replace the previous per-click hint with a compact strip anchored to the left toolbox showing the current step verbatim ("Select the vertex."). Esc cancels the draft; re-clicking the same tool cancels too. Tool stays active after each completion for rapid repeat placement.

## Files touched

- `GeometryToolbox.tsx` — inline value input + step hint strip.
- `useGeometryEditor.ts` — `annotationDraft` state, setters, cancel.
- `GeometryCanvas.tsx` — replace inline-edit-on-create flow with draft-driven placement; add smart trace closing.
- `src/lib/geometry/scene.ts` — optional `edges` on `GeoRegion`; optional `bold/italic/rotation` on label/segment.distance/angle.value.
- `src/lib/geometry/editor/sceneOps.ts` — extend `addRegion`, add distance-only label anchor.
- `src/lib/geometry/editor/boundary.ts` — new resolver.
- Region renderer in geometry viewer — draw path from `edges` when present.
- `SelectionInspector.tsx` — add Bold/Italic/Rotation controls; wire distance/angle rotation.

## Out of scope

- Automatic Selection Laws (unchanged).
- No changes to construction tools.
- No new persistence — extended fields ride along in the existing scene JSON.

Confirm and I'll implement.
