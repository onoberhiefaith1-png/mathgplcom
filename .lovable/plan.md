## Selection Laws for the Geometry Editor

Implement three deterministic "selection laws" so the right-hand inspector always exposes the right control for what the teacher clicked.

### 1. One-line law → Distance (always on)

When the current selection is exactly one 1D piece — a full segment, a sub-segment between two adjacent points, an arc sub-piece, or a curve sub-piece — the inspector always shows:

- **Distance** field (numeric input, pre-filled with the measured length, editable).
- **+ Add text** button underneath to attach a floating descriptor (e.g. "landmark").

Today `SegmentBodyPanel` hides Distance when `hasDist` is false. Change the rule so Distance is always visible for a one-line selection; the value defaults to the computed length and the user can override/clear it. Extend the same panel shape to arc-sub and curve-sub selections (they currently fall through to generic panels).

### 2. Two-line law → Angle (always on)

When the selection is exactly two 1D pieces that share a common endpoint (straight, arc, or curve — any combination), the inspector shows:

- **Angle** input (numeric, accepts any value incl. reflex >180°).
- Reflex toggle (already exists for straight-straight; extend to curve/arc pairs by using the tangent direction at the shared point).
- **+ Add text** button underneath for a descriptor label near the vertex.

Today the angle editor only triggers for two straight segments sharing a point. Extend `pickAnglePair` (or the equivalent selection classifier) to accept arc-sub and curve-sub pieces and compute the shared-vertex tangent angle.

### 3. Enclosed-region law → Area + shade + inside text

An "enclosed region" is any closed boundary with no opening:

- A full circle with no named points on it (single closed curve).
- Any cycle formed by segments / arc-subs / curve-subs whose endpoints chain back to the start (already partly handled by `cycleFromSegments`).

When the selection resolves to an enclosed region, the inspector shows:

- **Shade colour** picker (existing).
- **Area** field — computed value shown, editable so the teacher can override the displayed number.
- **+ Add text inside** button — creates a floating label anchored at the region centroid; label is immediately selected for editing (already wired for polygonal regions, extend to circle and mixed-boundary cycles).

### Universal "+ Add text" behaviour

Every one of the three panels gets the same `+ Add text` affordance. Clicking it:

1. Calls `addFloatingLabelAtShape` at a sensible anchor (segment midpoint, angle bisector at vertex, region centroid).
2. Auto-selects the new label so `LabelPanel` opens with text / size / colour / rotation ready to edit.

### Technical notes

- `src/lib/geometry/editor/snap.ts` — extend sub-piece detection (already added for circle/arc) to curves; expose a `classifySelection(scene, selection)` helper returning `"one-line" | "two-line" | "region" | "other"`.
- `src/lib/geometry/editor/regions.ts` — generalise `cycleFromSegments` to accept mixed boundary parts (segment / arc-sub / curve-sub) and to recognise a lone full circle / closed curve as a region.
- `src/components/lessonnotes/geometry-editor/SelectionInspector.tsx` — route by `classifySelection` result:
  - one-line → `SegmentBodyPanel` variant with Distance always visible + Add text.
  - two-line → `AnglePanel` variant supporting curved arms + Add text.
  - region → `RegionPanel` with Shade + Area + Add text inside.
- `src/lib/geometry/scene.ts` — add optional `area?: number` override on `GeoRegion`; distance override already exists on segments.
- Area computation: polygon shoelace for cycles, πr² for full circles, cycle-with-arcs via Green's-theorem sum of segment/arc contributions.
- Angle at a curved arm: use the unit tangent at the shared vertex (derivative of the parametric curve / arc direction) and take the signed angle between the two tangents; reflex toggle flips the 360°−θ complement.

### Out of scope (for this pass)

- No changes to bar chart / pie chart / math editor.
- No new tools in the geometry toolbar; laws are purely selection-driven.
- No AI-side changes.
