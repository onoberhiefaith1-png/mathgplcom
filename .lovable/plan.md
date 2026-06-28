
# Smart Geometry Engine

Upgrade the existing Geometry Editor so every diagram becomes a graph of recognised mathematical objects with live hover, multi-select, relationship detection, and a right-hand theorem panel. This is additive — the current `GeometryScene`, `GeometryCanvas`, `GeometryDiagram` and node view stay; we layer recognition + relationships on top.

## Scope (phase 1)

Ship the engine + UX skeleton with a focused set of theorems so it's usable end-to-end, then expand the theorem library iteratively.

Included now:
- Recognition for **triangles** (sides, vertices, interior angles, midpoints) and **circles** (centre, radius, diameter, chord, arc, tangent, point-on-circumference).
- Hover highlight + click multi-select on derived parts.
- Right-hand "Relationships" panel with Relationship Mode + Apply Mode.
- Initial theorem library: angle sum of triangle, isosceles, exterior angle, vertically opposite, angles on a straight line, Pythagoras, tangent ⟂ radius, angle at centre = 2× angle at circumference, angles in same segment, cyclic quadrilateral.
- Editable numeric values (angles, lengths, radius) with live recompute of dependents.
- "AI Edit" button that ships the current selection as context to the existing `geometry-edit` edge function.

Deferred to later phases (called out so we don't over-build):
- Graphs / tables / matrices / number lines (item 14 — foundation only).
- Image-import recognition (item 1 mentions imported images; we'll handle AI- and manually-drawn diagrams first).
- Full animation in expanded explanations.

## Architecture

New module: `src/lib/geometry/smart/`

```text
smart/
  parts.ts         // SmartPart types: SidePart, AnglePart, RadiusPart, ChordPart, ...
  recognize.ts     // GeometryScene -> SmartPart[] (graph w/ relations)
  relations.ts     // Theorem definitions + applicability predicates
  evaluate.ts      // Substitute scene values into a theorem -> Apply-mode equation
  hitTest.ts       // (x,y) -> SmartPart (for hover/click on derived parts)
```

`SmartPart` wraps a logical math object with: id, kind, label, sourceObjectIds (the raw scene objects it derives from), geometry (for hit-test + halo), and editable fields.

`Theorem` shape:
```ts
{ id, name, formula, genericDiagram, appliesTo(parts): boolean, instantiate(parts, scene): { equation, unknowns } }
```

State: a new `SmartGeometryContext` (one per diagram node) holds `parts`, `hoveredPartId`, `selectedPartIds`, and a memoised `candidateTheorems` derived from `selectedPartIds` via progressive filtering (item 5).

## UI changes

1. **`GeometryCanvas.tsx`** — add a transparent overlay layer above the SVG that:
   - on `pointermove` calls `hitTestSmartPart` and sets `hoveredPartId` (renders a glow on just that part).
   - on `click` toggles `selectedPartIds` (shift / plain click both add, click empty clears).
   - leaves all existing tool behaviour intact when an editor tool is active; smart-select is the default when `tool === "select"`.

2. **`RelationshipPanel.tsx`** (new, right side of diagram NodeView) — lists candidate theorems with:
   - Mode toggle: **Relationship** (generic A+B+C=180°, generic mini-diagram) / **Apply** (substituted: `40 + 65 + x = 180`).
   - Each row is `<Collapsible>` (already in `src/components/ui/collapsible.tsx`) with mini-diagram + explanation + "why it applies".
   - Empty state: "Select an object in the diagram".
   - "AI Edit selection" button at the bottom.

3. **`GeometryDiagram` NodeView** — wrap the existing diagram + canvas in a 2-column layout: diagram left, `RelationshipPanel` right, only when the diagram is active. Collapsed otherwise so the lesson note layout is unchanged.

4. **Editable values** — click any rendered numeric label (angle value, segment length, radius) opens the existing `inlineEdit` input; on commit we `patchObject` the underlying scene object. Dependent values (circumference, diameter, area, recomputed unknowns) are derived live by `evaluate.ts`, not stored.

5. **Label rename** — clicking a point label opens the same inline editor; renaming `A → P` updates `label` on the point, and all derived parts/theorems re-render with the new name automatically because they read from the scene.

## AI integration

`geometry-edit` edge function already accepts a scene + instruction. Extend the client call to include `selection: { kind, ids, label }` for the selected SmartPart(s). No edge function code change required for phase 1 — the model just gets richer context in the prompt the client sends.

## Files

New:
- `src/lib/geometry/smart/parts.ts`
- `src/lib/geometry/smart/recognize.ts`
- `src/lib/geometry/smart/relations.ts`
- `src/lib/geometry/smart/evaluate.ts`
- `src/lib/geometry/smart/hitTest.ts`
- `src/components/lessonnotes/geometry-editor/SmartGeometryContext.tsx`
- `src/components/lessonnotes/geometry-editor/RelationshipPanel.tsx`
- `src/components/lessonnotes/geometry-editor/SmartOverlay.tsx` (hover/select highlight layer)

Edited:
- `src/components/lessonnotes/geometry-editor/GeometryCanvas.tsx` — mount `SmartOverlay`.
- `src/components/lessonnotes/extensions/GeometryDiagram.tsx` — wrap with `SmartGeometryProvider` + render `RelationshipPanel` when active.
- `src/components/lessonnotes/GeometryDiagram.tsx` — expose hit-targets via stable ids (`data-part-id`) so the overlay can highlight statically rendered diagrams too.

## Out of scope this turn

- The bug visible in console (`duplicate key "h-p49"` from halo rendering when the same id is selected + pending + flashed) — flag for a separate fix unless you want it bundled.

## Open question

Phase 1 ships the triangle + circle theorem set above. Do you want me to also include **parallel-line angle theorems** (alternate, corresponding, co-interior) in phase 1, or push those to phase 2?
