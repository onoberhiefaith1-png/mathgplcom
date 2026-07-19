## Manual Annotation Tools — Left Toolbar

Add a second section in the left `GeometryToolbox` beneath the five construction tools, containing four permanent annotation tools that guide the teacher through step-by-step workflows. These are independent of selection and act as a reliable fallback when auto-detection fails.

### 1. Toolbox UI (`GeometryToolbox.tsx`)

Add a divider + section titled **"ANNOTATION"** below the existing 6 slots, containing:

- Add Text (icon: `Type`)
- Add Distance (icon: `Ruler`)
- Add Angle (icon: `Triangle` / arc-with-vertex)
- Add Area (icon: `Paintbrush` / filled polygon)

Each activates a new `ToolId` and shows a small status hint bar at the top of the canvas: *"Select a position…" / "Select the first point…" / "Trace the enclosed region…"*. Esc cancels; clicking the tool again also cancels.

### 2. New Tool IDs (`src/lib/geometry/editor/tools.ts`)

Add: `addText`, `addDistance`, `addAngle`, `addArea` to `ToolId`. Add group `"annotate"` in `TOOL_GROUPS`.

### 3. Canvas behaviour (`GeometryCanvas.tsx`)

Extend the existing pending-step state machine (already used by line/curve/arc/compass) with four new modes:

**Add Text** — 1 click anywhere → create a free floating text at the click point (not attached to any object) → auto-focus its content field in the right panel → tool stays active for the next placement until Esc.

**Add Distance** — 2 clicks. Each click resolves to a point (snap to existing point or create a new free point). After the 2nd click, place a distance label at the midpoint of the segment those two points define; if a segment between them doesn't exist yet, we do NOT create geometry — the label just stores `{fromPointId, toPointId}` and renders at the live midpoint. Auto-focus value field.

**Add Angle** — 3 clicks: arm1, vertex, arm2 (each snaps or creates). Store as `{a, vertex, b}` angle annotation. Render standard arc + label. If value entered is `90` or `90°`, swap to right-angle square automatically (already handled elsewhere; reuse).

**Add Area** — Manual trace. Each click snaps to nearest geometry (segment/arc/circle/curve) via existing `snap.ts` helpers, appending a boundary vertex. Show a live rubber-band polyline along the traced boundary segments. Closing (click near start point, or Enter) commits an area annotation whose boundary is an ordered list of geometry references + snap points; the region is filled and opens the Area panel.

### 4. Annotation data model

Extend `GeometryScene` with a new `annotations` array (does not affect existing geometry objects):

```ts
type Annotation =
  | { id; kind: "text"; x; y; content; fontSize; color; rotation }
  | { id; kind: "distance"; a: PointId; b: PointId; value; fontSize; color; offset }
  | { id; kind: "angle"; a: PointId; vertex: PointId; b: PointId; value; fontSize; color }
  | { id; kind: "area"; boundary: TraceStep[]; fill; opacity; label; texts: TextRef[] };
```

Where existing floating labels already have similar plumbing — reuse the `floating` label system for Text/Distance/Angle rendering and drag; Area is new.

### 5. Right-hand panels (`SelectionInspector.tsx`)

Route each annotation kind to a dedicated panel:

- **TextPanel** — Content textarea, Font Size slider, Colour swatch, Rotation slider, Delete.
- **DistancePanel** — Value input, Label Size slider, Colour, Offset slider (perpendicular offset from midpoint), Delete.
- **AnglePanel** — Value input (auto-converts `90` → right-angle square), Colour, Label Size, Delete.
- **AreaPanel** — Fill Colour, Opacity slider, Area label input, "+ Add text inside" button (creates a Text annotation seeded at region centroid), Delete fill.

All annotations are click-selectable and draggable (label position stored separately from anchor). Clicking any existing floating label / measurement on the canvas continues to open its panel as it does today.

### 6. Interaction rules

- Tool stays active after completion so the teacher can place multiple annotations in a row; Esc or clicking Select exits.
- Snap radius identical to construction tools.
- Auto-detection Selection Laws are unchanged — these tools are additive.

### Files touched

- `src/lib/geometry/editor/tools.ts` — add 4 ToolIds + group.
- `src/components/lessonnotes/geometry-editor/GeometryToolbox.tsx` — add Annotation section.
- `src/components/lessonnotes/geometry-editor/GeometryCanvas.tsx` — 4 new step machines + trace renderer.
- `src/lib/geometry/scene.ts` (or nearest scene type file) — add `annotations` array + types.
- `src/lib/geometry/editor/sceneOps.ts` — add/update/delete annotation helpers.
- `src/components/lessonnotes/geometry-editor/SelectionInspector.tsx` — four new panels + routing.
- `src/components/lessonnotes/geometry-editor/GeometryEditorPanel.tsx` — pass annotations to inspector / renderer.

### Out of scope

- No changes to the automatic Selection Laws behaviour.
- No new backend/schema — annotations persist inside the existing scene JSON already saved for the diagram.

Confirm and I'll implement.
