
# Geometry Editor — Selection, Splitting, Angles, Regions

Four connected upgrades to the geometry editor. Each is self-contained and layered on the existing `scene.ts` + `SelectionInspector` code.

## 1. Points dissect lines (auto-split)

Right now `DO` stays a single segment even when point `E` is dropped on it, so editing `DE` edits the whole thing.

- When a `Point` is added and lies within a small pixel tolerance of an existing `segment`, `line`, `ray`, or `arc`, replace that object with **two** objects that share the new point:
  - `DO` (D→O) with E on it → becomes `DE` (D→E) and `EO` (E→O).
  - The two children inherit style (dashed, color, arrow, marks) from the parent so nothing visually changes at split time.
  - Arrows: `start` stays on the first child, `end` on the last child, `both` splits into `start` + `end`.
- Dragging an existing point onto a segment does the same split; dragging it off restores nothing (children stay independent — matches "each part functions as a different line").
- Deleting a point that is the shared endpoint of exactly two collinear segments **re-merges** them into one segment (D–E + E–O → D–O). Style is taken from the first child; a small note in the inspector confirms the merge.
- A new helper `splitAtPoint(scene, segmentId, pointId)` and `mergeThroughPoint(scene, pointId)` live in `src/lib/geometry/editor/sceneOps.ts`.

## 2. Per-object highlighting + click-toggle multi-select

- Clicking any dot, segment body, arc, or curve **toggles** it in the selection set. Clicking empty canvas clears. No Shift required. (This replaces today's replace-on-click behavior.)
- Highlight glow is drawn per hit target only: clicking segment `DE` glows just `DE`, not points D or E. Points glow only when a point is the hit.
- The inspector title reflects the selection:
  - 1 point → `POINT · D`
  - 1 segment → `LINE · DE`
  - 2 segments → `2 SEGMENTS · DE, EO`
  - 2 points → `2 POINTS · E, O`
  - mixed → `SELECTION · 3 items`

## 3. Context-sensitive panel by selection shape

Rules used to pick which panel to show (extends `SelectionInspector.tsx`):

| Selection | Panel shown |
|---|---|
| 1 point | Point props (existing) |
| 1 segment | Segment props (existing) |
| 2+ points | **Angle** editor (see below). Single-line props (color, dashes, arrows) are hidden. |
| 2+ segments sharing an endpoint | **Angle** editor at the shared vertex |
| 2+ segments not sharing a point | Only shared props: colour, dashed style |
| Closed cycle detected | Adds **Region** section (see §4) on top of whatever panel is active |

## 4. Angle tool (multi-select)

- Vertex is chosen automatically:
  - 2 segments → their shared endpoint.
  - 2 points → user picks a third selected point as vertex, or if only two points are selected the panel shows "Select the vertex point too" hint.
- Panel fields:
  - **Value** — free-text/number input. **No validation** — 30, 180, 360, 1000, "x + 40" all accepted. Renders as `30°` on canvas (append ° automatically if value is purely numeric).
  - **Side** — a pair of ▲ / ▼ chevron buttons right next to the value. Up flips the arc to the reflex / opposite side; down brings it back. Internally toggles a `reflex: boolean` flag on the `angle` object.
  - **Marker** — arc / double arc / right-angle square (existing enum).
- Angle object already exists in `scene.ts` (`type: "angle"`); we add a `reflex?: boolean` field and reuse the render path.

## 5. Enclosed region auto-detection + shading

- After every commit, run `findClosedCycles(scene)` (new file `src/lib/geometry/editor/regions.ts`). It walks the segment graph and returns cycles; a full circle counts as its own region.
- When the current selection **is** a closed cycle (or a lone full circle), the inspector adds a `Region` fold:
  - **Fill colour** (with transparent option)
  - **Opacity** slider
  - **Remove fill** button
- Regions render behind segments so ink stays crisp. Stored as a new `region` object type: `{ id, type: "region", boundary: GeoId[], fill, opacity }`.
- No manual "Create region" click needed — the panel just appears when a valid loop is selected.

## Files touched

- `src/lib/geometry/scene.ts` — add `reflex?` on angle, new `region` object type.
- `src/lib/geometry/editor/sceneOps.ts` — `splitAtPoint`, `mergeThroughPoint`, `addRegion`, hooks into add-point and delete-point ops.
- `src/lib/geometry/editor/snap.ts` — teach `pickHit` to prefer segment-body hits over the parent's old bounding line; return the correct child segment id.
- `src/lib/geometry/editor/regions.ts` (new) — cycle finder over the point/segment graph.
- `src/components/lessonnotes/geometry-editor/useGeometryEditor.ts` — switch click handler to toggle-selection; recompute selection kind from set.
- `src/components/lessonnotes/geometry-editor/SelectionInspector.tsx` — new title logic, `AnglePanel`, `RegionPanel`, hide single-line props on multi-selection.
- `src/components/lessonnotes/geometry-editor/GeometryCanvas.tsx` / `GeometryDiagram.tsx` — per-segment glow, region fill layer, reflex arc rendering.

## Out of scope (explicitly)

- No numeric validation on angle values.
- No renaming of split segments beyond automatic `${a}${b}` labels.
- No drag-to-flip on the angle arc; only the ▲/▼ chevrons in the panel.
