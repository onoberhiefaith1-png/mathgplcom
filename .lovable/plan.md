# Right-hand Diagram Annotation panel + continuous editable canvas + Erase tool

Two independent pieces of work: (A) a clean, structure-aware annotation panel on the right, and (B) fixes so the whole extended page stays editable, sections insert below diagrams, and erasing works per segment.

## A. Right-hand Diagram Tools panel

The left floating Geometry panel (Select, Point, Line, Circle, Arc, Curve, Add Text, Add Distance, Add Angle, Add Area) stays exactly as it is — it remains the free-placement/backup system. Nothing in it is removed or renamed.

The right-hand panel gains a small "Diagram Tools" block at the top with exactly three actions:

```text
┌──────────────────────────┐
│  Diagram Tools           │
│   T  Add Text            │
│   ∠  Add Angle           │
│   ◇  Add Area            │
│  ─────────────────────── │
│  [existing structure &   │
│   selection properties]  │
└──────────────────────────┘
```

No Add Distance here — a distance is just text on a line.

**Add Text** — prompts "Click a point or line to label it".
- Click a point: label anchored to that point, drawn beside it, moves when the point moves.
- Click a line (segment, sub-arc or sub-curve piece): label anchored to the line, placed at its midpoint and rotated to the line's direction, kept upright/readable when the line's angle passes vertical. Re-orients automatically when endpoints move.

**Add Angle** — asks for the value first ("Enter angle value", e.g. `45`, degree symbol added automatically), then "Click two lines that meet". The two picked lines determine the shared vertex and the two arms; the annotation is created on the internal angle by default. The existing internal/external drag control at the vertex is kept as-is, so the teacher can still flip the annotation between regions.

**Add Area** — "Click the points forming a closed shape". Clicked points/edges are tracked and checked after each click for closure (last selection returns to the start). On closure the enclosed region is created and the area value is placed inside the region, using the existing region/area functionality (fill, opacity, value formatting) unchanged.

**Removed from the right panel:** the current behaviour where merely selecting a line lists its name plus an "Add Text"/distance action underneath. Annotations are only created when the teacher explicitly picks a tool and then clicks the target. Everything else in the panel (point/line/circle/arc/curve properties, parallel, perpendicular, equal marks, midpoints, relationships, undo/redo, Delete Diagram) is untouched.

The underlying geometry engine is reused throughout — no new scene model.

## B. Continuous editable document + Erase

**1. Whole extended page is editable.** The extension space and the geometry canvas already live inside the interaction layer, but blank-paper clicks are short-circuited while Geometry Mode is on and the notebook-wide overlay sits above the space under a diagram. Fix so that anywhere below a diagram — including newly extended space — accepts drawing, text boxes, sensors, typing and further diagrams, exactly like the top of the page.

**2. Double-click below a diagram.** A double-click in blank space under a diagram must open a text/sensor input at that exact point instead of doing nothing or jumping the caret to the top. The position is taken from the click coordinates in the interaction layer, and the new input receives focus immediately.

**3. Add Section respects document position.** Add Section must append after the last content, including when the last thing on the page is a diagram, rather than landing above it. Since a placed diagram lives on the notebook geometry layer rather than in the text flow, the insert position is computed from the lowest content on the page (text flow end and diagram extent), not from a possibly stale caret.

**4. Erase becomes a tool, not a draggable dustbin.** The toolbar button becomes "Erase" and toggles erase mode: while active, hovering the diagram highlights the individual segment under the pointer and clicking removes only that piece. No object follows the pointer, and pressing the button again (or Escape) leaves erase mode.

**5. Segment-level erase.** Highlighting and erasing operate on structural pieces: for `A─B─C─D─E`, hovering between A and B highlights only A–B, and erasing removes only A–B. Neighbouring segments stay, and shared points survive while any remaining segment still uses them. Undo/redo continues to work through the existing geometry history.

## Technical notes

- New right panel block rendered above `SelectionInspector` (`src/components/lessonnotes/geometry-editor/SelectionInspector.tsx` / its host in `DocumentEditor.tsx`), driving new structure-aware tool states through `GeometryModeContext` so the left panel's tool ids stay untouched.
- Text anchoring reuses `addFloatingLabel`/`patchObject` with a point/line owner ref; line labels compute midpoint and rotation from endpoint coordinates at render time so they track edits.
- Angle creation reuses `addAngle(scene, vertex, a, b, value)`; two-line pick resolves the shared endpoint. Area closure reuses `cycleFromSegments` / `regions.ts` and existing fill+value handling.
- Line-item listing in `classifyLineItems` stops driving an implicit annotation action; it stays only for properties display.
- Erase mode replaces `dustbinDrag` in `DocumentEditor.tsx`; hit-testing keeps `pickObject` (which already returns sub-piece ids like `id#2`) and deletion keeps `eraseObject` in `src/lib/geometry/editor/sceneOps.ts`, verifying it removes only the picked piece and no still-referenced points.
- Blank-space handling: `handlePaperMouseDown` gains a geometry-mode-aware path plus a double-click handler; the notebook geometry overlay's pointer capture is scoped so blank regions below diagrams remain reachable.
- Section insertion: `sectionInsertPosition()` falls back to document end when the trailing content is a diagram.
