# Regression report — 2D / Area

Status of this report: **Phase 1 evidence only.** Nothing was repaired while
writing it. Requirement records live in `src/lib/integrity/standard/geometry.ts`
(`AREA-001` … `AREA-008`, plus `GEO-001` … `GEO-011`).

## 1. What Area is approved to be

Two independent entrances, which the approved plan of 2026-08-15 explicitly
separates:

```text
LEFT toolbox  "Add Area"  (tool: addArea)
    click… click… click…            manual boundary trace
    straight mode → straight edges
    curve mode    → overlapping point triplets, curve through the middle point
    close         → filled region with the chosen colour + density

RIGHT panel   "Add Area"  (tool: smartArea)
    configure first:  Area Colour, Density
    then pick:        click boundary LINES
    cycle closes  →   region filled with the chosen colour + density
                      workflow card closes, region stays selected
```

The plan of 2026-08-15 also records a verified fact worth keeping: the left-hand
toolbox (`GeometryToolbox.tsx` / `GeometryToolbar.tsx`) was **not** modified by
the right-hand panel work, and the two tools keep separate cases in the canvas
and separate draft seeding. That separation is now pinned as `AREA-001`.

## 2. Current implementation

| Layer | Location | Role |
| --- | --- | --- |
| Scene model | `src/lib/geometry/scene.ts` | `GeometryScene = { bounds, objects, meta? }`; `EMPTY_SCENE` is 360×240 with no objects. |
| Region construction | `src/lib/geometry/editor/sceneOps.ts` | `addRegion` (rejects < 3 points, resolves per-edge geometry via `findConnectingEdge`, stores `fill`/`opacity`), `addCurvedRegion` (triplets + curve objects). |
| Cycle detection | `src/lib/geometry/editor/regions.ts` | `cycleFromSegments` returns a boundary only for one simple closed cycle where every vertex has degree two; open/incomplete chains return `null`. |
| Boundary resolution | `src/lib/geometry/editor/boundary.ts` | `regionEdgesToPath` builds the fill path, straight or curved. |
| Interaction | `src/components/lessonnotes/geometry-editor/GeometryCanvas.tsx` | `case "smartArea"` (~line 676) and `case "addArea"` (~line 703); preview path ~line 869; double-click close ~line 974; Enter close ~line 989; pending-pick clear on tool change ~line 124. |
| Panels | `GeometryToolbox.tsx`, `DiagramToolsPanel.tsx`, `GeometryModeContext.tsx`, `SelectionInspector.tsx` | Tool entry, colour/density draft, workflow card, region properties. |
| Rendering | `src/components/lessonnotes/GeometryDiagram.tsx` | Renders regions from stored edges, with a polygon fallback for legacy regions. |

## 3. Validation performed in this pass

`src/lib/geometry/__tests__/area.test.ts` was written as the engine-layer
restoration evidence and **passes** (6 tests, 2026-08-25):

- straight trace creates one region carrying the chosen fill and opacity;
- a boundary of fewer than three points creates nothing;
- per-edge geometry is stored and produces a non-empty fill path;
- a curved trace builds a region plus curve objects;
- picked boundary lines close only when they form a complete cycle;
- an open chain of lines is rejected.

**Conclusion for the engine layer: not regressed.** Region construction, cycle
detection and fill/opacity storage all behave as approved.

## 4. Finding — the close paths lose the teacher's choices (`AREA-005`, PARTIAL, MEDIUM)

The approved behaviour is that the chosen Area Colour and Density are applied to
the created region, and that on success the workflow closes with the region
selected.

Evidence in `GeometryCanvas.tsx`:

- **Close by clicking the first point** (`case "addArea"`, ~line 715-740) reads
  `annotationDraft.fillColor` / `fillOpacity`, passes `{ fill, opacity }` into
  `addRegion` (or patches the curved region with them), and calls
  `finalizeSession(...)`, which cleans up the temporary trace points.
- **Close by double-click** (~line 974) calls
  `addRegion(scene, pendingIds)` / `addCurvedRegion(scene, pendingIds)` with
  **no options**, and does not call `finalizeSession` or select the region.
- **Close by Enter** (~line 989) is the same as the double-click path.

Consequence: a region closed by double-click or Enter takes the engine defaults
instead of the colour and density the teacher chose, temporary trace points are
not cleaned up, and the new region is not left selected for further editing.
`smartArea` is unaffected — it passes `{ fill: fillS, opacity: opacityS }`.

Restoration source: the close-on-first-point branch is the correct reference
implementation, and the approved plan
`.lovable/plan/right-hand-add-area-configuration-first-then-region-pick-2026-08-15.md`
states the required behaviour. A Phase 3 correction is therefore scoped and safe,
but it is **not** applied here.

## 5. Finding — unfinished manual traces (`AREA-006`, note)

The tool-change effect clears pending picks for `smartArea`
(`if (prev === "smartArea") setPendingIds([])`, ~line 124). The equivalent clear
for an unfinished **manual** `addArea` trace was not confirmed in this pass.
`Escape` does clear `pendingIds` in the key handler. Recorded as a note on
`AREA-006` rather than as a failure, because the approved plan's point 4 is
written about the right-hand tool.

## 6. Finding — deletion unverified (`AREA-008`, UNKNOWN, LOW)

"Delete Diagram" and single-region deletion were approved together with the
Fill/Opacity controls. Neither was exercised in this pass, so the status is
`UNKNOWN — REQUIRES HUMAN CONFIRMATION` rather than an assumed pass.

## 7. Removed components, routes, data, permissions

- **Removed components/functions:** none found. No Area component, canvas case
  or scene operation is missing relative to the approved design. `regions.ts`,
  `boundary.ts`, `sceneOps.ts`, both canvas cases and both panels are present.
- **Routes:** Area has no route of its own; it is reached inside the diagram
  editor (`/lesson-notes`, `/mathboard`, `/smartboard` surfaces).
- **Data:** regions are stored inside the diagram scene on the lesson-note
  block. No Area-specific table exists or is required.
- **Permissions:** Area inherits lesson-note write permissions (`LN-009`). No
  Area-specific policy exists.

One historically related deletion is recorded elsewhere, not here:
`src/lib/smartboard/boardAssignment.ts` was deliberately deleted by the
2026-08-24 Board A revert to avoid a second source of truth for object routing.
That is a diagram-routing change (`DIAG-004`), not an Area change.

## 8. Cause and blocker

- **Cause of the `AREA-005` gap:** the colour/density support was added to the
  primary close path (click the first point) and to `smartArea`, and the two
  secondary close paths in the pointer/keyboard handlers were not updated with
  it. Nothing was removed; a later addition was not propagated.
- **Blocker to closing it automatically:** the defect lives in event handlers,
  not in the engine, so the passing engine tests cannot see it. Closing it needs
  either a scoped edit in `GeometryCanvas.tsx` plus a browser-level check, or a
  refactor extracting one shared `closeAreaTrace()` helper. Either is a Phase 3
  correction requiring Administrator approval.

## 9. Tests

Present:

- `src/lib/geometry/__tests__/area.test.ts` — engine layer, passing.

Missing (recorded as Section I actions, not created in Phase 1):

- a pointer-level check that all three close paths apply the chosen fill and
  density and finalise the session;
- a check that an unfinished manual trace is discarded on tool change;
- a region-deletion check.
