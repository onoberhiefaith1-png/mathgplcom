## Selection Laws — refined per-count rules

Rewrite the multi-selection inspector so the panel content is driven strictly by **how many lines/arcs the teacher clicked** and **whether those clicks form a closed loop**. Never assume "the full circle is enclosed" from a single sub-arc click.

### The laws (final)

Let N = number of line-like items selected (segments, sub-arcs, sub-curves). A "full circle with no points on it" counts as N = 0 (closed by itself).

| N | Panel shows |
|---|---|
| 0 (bare full circle, no points) | Area / Shade only |
| 1 (one segment OR one sub-arc OR one sub-curve) | **Distance** for that one item + Add text. **No Area, no Angle.** |
| 2 sharing a vertex | **Distance ×2** (one per item) + **Angle at shared vertex** + Add text. **No Area** unless the two items plus a third edge already close — which at N=2 they don't, so never. |
| 2 not sharing a vertex | Distance ×2 + Add text. No Angle, no Area. |
| ≥3 | Distance ×N (one field per selected item) + Angle ×K at every shared vertex among the selection + **if the selected items form a closed loop → Area + Shade controls + Add text inside** |

Closure test for N ≥ 3: build a graph of endpoints of the selected items; it's closed iff every endpoint has even degree ≥ 2 and the items form a single connected cycle. Sub-arcs contribute their two endpoint points; a bare full circle contributes zero endpoints and is always closed.

### Changes

**`src/lib/geometry/editor/snap.ts`** — add `classifySelection(scene, ids): { items: SelectedItem[]; sharedVertices: GeoId[]; closed: boolean }`. `closed` uses the endpoint-graph cycle test above. Never returns `closed: true` for a single sub-arc just because its parent circle is closed.

**`src/components/lessonnotes/geometry-editor/SelectionInspector.tsx`**
- Replace the current `MultiPanel` branching with one component driven by `classifySelection`:
  - Render one `DistanceRow` per selected item (segment length, sub-arc chord/arc length, sub-curve length). Each row: label of the item (e.g. "I₁L₁", "arc P₁Q₁"), editable value, Add-text button that drops the value as a floating label near that item's midpoint.
  - Render one `AngleRow` per shared vertex, listing the two (or more) items meeting there. Each row: value input, reflex toggle, marker style, Add-text button placing the label at the vertex.
  - Render the `AreaPanel` (Shade toggle, color, opacity, Area value, "+ Add text inside") **only when `closed === true`**.
- Remove the current "circle → always show Area / Shade" behaviour. `FillablePanel` for a bare circle stays, but a sub-arc selection routes through the new classifier and shows Distance only.
- `AngleFromSegmentsPanel` is deleted; its behaviour is folded into the per-vertex `AngleRow`.

**`src/lib/geometry/editor/regions.ts`** — expose `isClosedLoop(scene, ids)` used by the classifier (mixed segments + sub-arcs + sub-curves).

**`src/lib/geometry/scene.ts`** — no schema change; the existing optional `area` field on region/circle/arc/curve stays and is only surfaced when the classifier says `closed`.

### Acceptance (matches the three screenshots)

1. Image 1 — one sub-arc selected on the big circle: panel shows **Distance** + Add text only. No "Shade enclosed area", no Area field, no Angle.
2. Image 2 — two segments meeting at a vertex: panel shows **Distance (seg 1)**, **Distance (seg 2)**, **Angle at vertex** with value + Add text. No Area.
3. Image 3 — three items forming a closed triangle-like loop: panel shows **Distance ×3**, **Angle ×3** (one per shared vertex, each independently editable with its own Add text), plus **Area + Shade + Add text inside**. If the same three items don't close, Area disappears automatically.
