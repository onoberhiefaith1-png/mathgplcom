
# Geometry Editor — Point & Segment fixes

Scope: only the **Point** and **Line/Segment** tools. The five-tool left rail and the right-hand foldable panel already exist and stay as-is. Circle / Arc / Curve are out of scope for this pass.

The core problem is that today clicking anywhere on a segment or its endpoints selects "the segment" as one thing, points don't have their own inspector, and the right panel just shows a flat list. This pass makes **Point**, **Point Label**, **Line Label**, and **Segment body** four independent selectable objects, each with its own inspector.

---

## 1. Data model additions (`src/lib/geometry/scene.ts`)

Only additive — no breaking changes.

- `GeoPoint`: add `color?: string`, `size?: number` (radius; default 2.4), keep existing `hidden`, `labelOffset`.
- `GeoSegment`: add
  - `color?: string`
  - `arrow?: "none" | "start" | "end" | "both"` (default `"none"`)
  - `parallelMarks?: 0 | 1 | 2 | 3` (new, separate from `marks` so equality marks and parallel marks are independent groups)
  - extend `marks` to also allow `"quadruple"` (four ticks)
  - `labelOffset?: { dx: number; dy: number }` (for draggable segment label)
  - `distance?: string` and `distanceOffset?: { dx: number; dy: number }` (draggable distance text — renamed use of existing `length` semantics; migration keeps `length` as fallback)

## 2. Hit testing — split segment into 4 parts (`src/lib/geometry/editor/snap.ts`)

Rewrite `pickObject` to return a richer hit descriptor:

```ts
type Hit =
  | { kind: "point"; id: GeoId }
  | { kind: "pointLabel"; id: GeoId }         // point's label glyph
  | { kind: "segmentBody"; id: GeoId }
  | { kind: "segmentLabel"; id: GeoId }       // segment name label
  | { kind: "segmentDistance"; id: GeoId }    // draggable distance chip
  | { kind: "circle" | "arc" | "curve" | ...; id: GeoId };
```

Priority (highest first): point → point label → segment label → segment distance → segment body → other shapes. Existing callers that only want an id keep working through a thin `pickObjectId()` wrapper.

## 3. Selection state (`useGeometryEditor.ts`)

Replace `selectedIds: GeoId[]` with `selection: Hit[]` (keeps multi-select). Add helpers `selectionKinds()` and `primarySelection()`. Segment-body multi-select is supported (shift-click adds another segment body).

## 4. Canvas interactions (`GeometryCanvas.tsx`)

Select tool becomes context-sensitive:

- Click a **point dot** → select `{kind:"point"}`. Drag = move point (already works; keep). Every dependent segment/circle/arc/curve updates automatically because they reference the point id.
- Click a **point's label** → select `{kind:"pointLabel"}`. Drag = update `labelOffset` on that point (point stays put).
- Click a **segment body** (>4 px away from endpoints and labels) → select `{kind:"segmentBody"}`. Shift-click another segment body to multi-select.
- Click a **segment label** → select `{kind:"segmentLabel"}`; drag updates `labelOffset`.
- Click a **distance chip** → select `{kind:"segmentDistance"}`; drag updates `distanceOffset`.

Highlight overlay: only the selected part gets the dashed halo. Endpoints of a selected segment are **not** highlighted. Selecting a point does not highlight any segment.

## 5. Right-hand inspector rewrite (`SelectionInspector.tsx`)

Replace the current flat form with a **context-sensitive** panel driven by `selection`:

- **Empty**: hint text.
- **Point** (`kind: "point"`): only two rows — **Point Colour** (color input), **Hide Point** (checkbox). Hide toggles `hidden` on the point (renderer already skips hidden points; extend to also skip the label).
- **Point Label** (`kind: "pointLabel"`): **Rename** text input (updates `point.label`). Note: dragging happens on the canvas.
- **Segment Body** (`kind: "segmentBody"`, one or many): foldable sections using shadcn `Collapsible`:
  - **Basic Line** (open by default): radio Solid / Dotted / Dashed → maps to `dashed: false | "dotted" | true` (extend `dashed` to `boolean | "dotted"`; renderer maps `"dotted"` to `strokeDasharray="1 3"`).
  - **Arrow** (collapsed): radio None / Start / End / Both → writes `arrow`.
  - **Equality Marks** (collapsed): radio None / 1 / 2 / 3 / 4 ticks → writes `marks`.
  - **Parallel Marks** (collapsed): radio None / 1 / 2 / 3 → writes `parallelMarks`.
  - **Distance** (collapsed): "Add distance" toggles a text input pre-filled with `distance`. Clearing the field removes only the distance.
  - **Line Colour**: color input → writes `color`.
  - Multi-select: every change is applied to all selected segments via `patchObject` in a loop.
- **Segment Label** (`kind: "segmentLabel"`): Rename input (updates `segment.label`).

Angle-from-two-segments and region selection are noted in the code as follow-up hooks but not implemented in this pass (the user said circle/arc/curve are next; angle/region will come with them).

## 6. Renderer updates (`GeometryDiagram.tsx`)

- Point: use `p.color ?? STROKE` and `p.size ?? 2.4`. When `hidden`, render neither dot nor label.
- Segment: use `o.color ?? STROKE`. Draw arrowheads based on `arrow`. Support `dashed === "dotted"` (`"1 3"`) alongside the existing dashed pattern. Render up to 4 equality ticks and 1–3 parallel chevrons (independent groups). Position segment label with `labelOffset` if present. Render `distance` (or legacy `length`) at `distanceOffset` if present.

## 7. Migration

`sanitizeScene` remains backward-compatible: existing scenes without the new fields render exactly as before. `length` continues to work as a fallback for `distance`.

## 8. Verification

- `tsgo` typecheck must be clean.
- Playwright smoke: open a lesson note, insert a Diagram, use Point tool to add 3 points, use Line tool to connect A–B–C, then:
  1. Click point A → right panel shows exactly **Point Colour** + **Hide Point**.
  2. Click label "A" → right panel shows only **Rename**; drag the label and confirm the dot stays fixed.
  3. Click segment AB body → right panel shows the 6 foldable line sections; changing Dashed on AB leaves BC solid.
  4. Shift-click BC → both selected; toggling Arrow=End applies to AB and BC only.
  5. Drag point B → both AB and BC follow (already works; regression check).

## Files touched

- `src/lib/geometry/scene.ts` — new optional fields on `GeoPoint`/`GeoSegment`.
- `src/lib/geometry/editor/snap.ts` — richer `Hit` type + `pickObject`.
- `src/components/lessonnotes/geometry-editor/useGeometryEditor.ts` — selection stores `Hit[]`.
- `src/components/lessonnotes/geometry-editor/GeometryCanvas.tsx` — dispatch by hit kind, drag label/distance offsets.
- `src/components/lessonnotes/geometry-editor/SelectionInspector.tsx` — full rewrite as context-sensitive panel with `Collapsible` sections.
- `src/components/lessonnotes/GeometryDiagram.tsx` — render color / size / arrow / dotted / 4 ticks / parallel group / draggable label + distance / hidden-label.

## Out of scope (next prompt)

Circle, Arc, Curve editing, angle-from-two-segments, enclosed-region shading. The inspector already has a `switch (kind)` seam where those cases will slot in.
