## Goals

1. **Highlight Law**: Selection is bounded by "at most two anchor points" per region.
2. **Add text / Add distance**: Make these buttons actually place editable, draggable, styleable labels.
3. **Universal text-selection**: Clicking ANY on-canvas text (label, distance, angle value, point label, floating text) opens its style controls in the right panel.
4. **Right panel width**: 10vw → 20vw so controls fit.

---

## 1. Highlight Law (max 2 endpoints per highlight)

Rule: a single highlight covers exactly the piece bounded by ≤2 named points.

- **0 points** (bare closed curve, e.g. a pristine circle with no points on it) → whole shape highlights.
- **1 point** (a lone dot, or a circle carrying exactly one point) → that dot/whole loop highlights.
- **2 points** (segment, arc between two points, chord of a circle between two points) → just that piece.
- **>2 points on the same curve** → the full curve can NOT be selected as one; only the individual 2-point sub-pieces (Q→Q1, Q1→N1, N1→N2, …) are selectable.

Implementation:
- Extend `pickHit` in `src/lib/geometry/editor/snap.ts` so circles and arcs with ≥2 points along them are hit-tested per sub-arc between consecutive angular neighbors, returning ids like `circleId#k` (same pattern already used for curves).
- Update `computeSceneExtent`/renderer halos in `GeometryCanvas.tsx` (already partially supports `#sub` for curves) to draw the halo on just the chosen sub-arc for circles/arcs.
- Prevent whole-circle selection when point count on that circle > 1 (fall through to sub-arc hit).
- Curves already sub-segmented — keep behaviour.

## 2. Add Text / Add Distance actually work

Current bug: `+ Add text` buttons in `SegmentBodyPanel`, `FillablePanel`, `RegionPanel` call `addFloatingLabel` but the click either doesn't dispatch or the created `GeoLabel` isn't selectable/editable.

Fixes in `SelectionInspector.tsx` + `sceneOps.ts`:
- Wire every "+ Add text" and "+ Add distance" button to `apply(addFloatingLabel(scene, x, y, initialText, { kind }))` and immediately select the new label so `LabelPanel` opens.
- For segments: distance label placed at midpoint offset perpendicular to line; text label placed at midpoint.
- For enclosed regions / circles / arcs: place at centroid.
- Default text = "" with placeholder "Double-click to edit"; distance default = computed length rounded.

Editing / dragging (`GeometryCanvas.tsx`):
- Double-click on a `label` hit opens the existing inline `<input>` (already implemented for `text` field) — extend to fire on double-click OR when the Label tool clicks it, not only via measure tool.
- Single-click already selects; drag already patches x/y — verify `labelDrag` case for `kind === "label"` writes to `x`/`y` not `dx`/`dy` (it currently mixes both — fix so `baseDx/baseDy` seed from `obj.x/obj.y` and the patch writes `{x, y}` directly).

## 3. Universal "click any on-canvas text → panel"

Everything the user sees as text should be a first-class selectable:
- Point labels (`A`, `B`, `P1`, …)
- Segment name label
- Segment distance value
- Angle value (`36°`)
- Free-floating `GeoLabel`

`pickHit` already returns kinds `pointLabel | segmentLabel | segmentDistance | angleValue | label`. In `SelectionInspector.tsx` add a top-priority routing: if `selectionKind` is any of these five, render **`LabelPanel`** (text, font size, color, rotation, delete) regardless of the parent object type, editing the appropriate field on the parent (`label`, `distance`, `value`, `text`) plus its `*Style` sibling for size/color/rotation.

Add `labelStyle`, `distanceStyle`, `valueStyle` sub-objects on `GeoSegment`/`GeoAngle`/`GeoPoint` in `scene.ts` (fontSize, color, rotation) so styling isn't limited to floating labels.

Update `GeometryDiagram.tsx` to consume those style fields when rendering each text element.

## 4. Right panel 10vw → 20vw

Find the inspector container (previously set to `w-[10vw]`) and change to `w-[20vw]` (with a sensible `min-w` like `min-w-[240px]`). The main content flex sibling already uses `flex-1` so the gap disappears automatically.

Files: whichever layout wraps `SelectionInspector` (likely `NotebookEditorPage.tsx` or a Lesson Notes layout — will locate before editing).

---

## Technical Summary

| Concern | Files |
|---|---|
| Sub-arc hit testing | `src/lib/geometry/editor/snap.ts`, `src/components/lessonnotes/geometry-editor/GeometryCanvas.tsx` |
| Circle/arc halo per sub-arc | `GeometryCanvas.tsx` halo block |
| Add text / distance buttons | `SelectionInspector.tsx`, `src/lib/geometry/editor/sceneOps.ts` |
| Label drag + inline edit | `GeometryCanvas.tsx` (`labelDrag` case, dblclick handler) |
| Universal text panel routing | `SelectionInspector.tsx`, `scene.ts` (add `*Style` fields), `GeometryDiagram.tsx` |
| Panel width | Layout file hosting `SelectionInspector` |

## Out of scope this turn

- Highlight-law behaviour for curves beyond current sub-segment model (already correct).
- Any AI/backend changes.

## Verification

Playwright script: open a lesson note, add circle + 3 points on it, click between two adjacent points → assert only that arc glows; click "+ Add distance" on a segment → assert a label appears, is draggable, and its style panel opens on click; click any label/angle value → assert `LabelPanel` renders; check right panel computed width ≈ 20vw.
