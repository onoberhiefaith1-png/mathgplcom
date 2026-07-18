## Goal

Keep the previously-agreed parts of the plan (unified text styling for point labels + angle values + segment distances, distance workflow, straight-line 180° angle). Replace **only** the "highlight cardinality" section with the correct rule below.

## Correct highlight rule — "alight region ≤ 2 adjacent points"

A highlightable region is bounded by **at most two adjacent anchor points**. It never spans a third point.

- **0-point objects** (a full circle, a curve with no interior anchors): the whole shape highlights as one unit.
- **1-point object** (a bare point / dot): just the dot highlights.
- **2-point region** (a segment between two adjacent points): only that sub-segment highlights — never a chain that crosses a third point.

Concretely, on the current diagram: line D→O was drawn as one line, then point E was dropped on it. From that moment the diagram contains **two independent segments, DE and EO** — there is no "DO" anymore. Clicking anywhere between D and E highlights only DE; clicking between E and O highlights only EO. Both may be highlighted at the same time (multi-select), and when both are highlighted the angle tool offers a 180° angle at vertex E (teacher-editable to any value, flippable ▲/▼).

### Why it's currently wrong

Auto-split on point-drop is already implemented in `sceneOps.addPoint` (via `findSegmentAt`), but at least one of these is likely still true and will be fixed:

1. The original `DO` segment wasn't dropped when E was inserted — it still exists alongside DE and EO, so hit-testing picks up the long segment. Fix: ensure `addPoint` **removes** the parent segment when it splits it, and copies its style onto both children.
2. The hit-test in `snap.pickHit` matches the long segment first because it's tested before the sub-segments. Fix: after §1 this becomes moot; also add a safety pass that, when multiple segments overlap a hit, prefers the shortest one.
3. Older scenes saved before auto-split still have a spanning `DO`. Fix: on scene load, run a one-time normaliser that walks each segment and, for every existing point that lies on it (within tolerance), splits it — so legacy diagrams get the same behaviour without the teacher having to redraw.

### Multi-select cardinality (revised)

- 1 highlighted → object inspector (point / segment / circle / arc / curve / label / angle value / distance chip).
- 2 highlighted → relationship inspector. Angle placement is offered when the two highlighted items share a common endpoint — this covers both "corner" angles (DE + EF) and "straight-line" angles (DE + EO). Default value is the geometric angle at the shared vertex (180° when collinear), fully editable.
- 3+ highlighted → bulk-only actions (colour, delete). No angle offered. The inspector shows: "Highlight at most 2 adjacent items to place an angle."

## Files to touch (delta from prior plan)

```text
src/lib/geometry/editor/sceneOps.ts      (addPoint: drop parent segment on split, copy style to children)
src/lib/geometry/editor/snap.ts          (prefer shortest segment on tie; new hit kinds from prior plan)
src/lib/geometry/editor/normalize.ts     (new: legacy-scene splitter run on load)
src/components/lessonnotes/geometry-editor/useGeometryEditor.ts (call normaliser once when scene comes in)
src/components/lessonnotes/geometry-editor/SelectionInspector.tsx (cardinality guard + collinear→180°)
```

Everything else from the previous plan (unified Text panel for labels / angle values / distances, distance add-flow, ▲/▼ flip, undo integration) stays as previously described.

## Out of scope

- Splitting a segment when a point is *moved* onto it after creation (only drop-time splitting is handled). If you want move-time splitting too, say so.
- Merging DE + EO back into DO when point E is deleted — the earlier plan already covered this via collinear merge in `eraseObject`; no change.
