# Geometry as a Transparent Smartboard Layer

The Smartboard owns the surface. The 2D Geometry workspace becomes a see-through drawing
layer over it: no panel background, ink that matches the board's current writing colour,
per-object colour overrides kept, plus a span control and collapsible side panels.

## What's true today (checked in the code)

- The board's 2D card is mounted through `FloatingToolLayer` with `solidBody` on for
  `kind === "2d"`, so the body gets `bg-background text-foreground` — that is the white/dark
  rectangle over the board. The shell itself also paints a translucent panel background.
- `GeometryWorkbench` wraps the canvas in a rounded container and the right panel in an
  `aside` with `bg-background/95`; the left `GeometryToolbox` uses `bg-background/95` too.
  Both panels already collapse independently.
- `GeometryDiagram` (the renderer used by both the live canvas and the committed render)
  already draws on a transparent SVG, but hardcodes `const STROKE = "#1f1f24"`. Per-object
  `color` overrides already win over that default, so custom colours already work.
- The board already resolves its writing colour as `ink = resolveInk(inkColorId, surface)`
  and passes a `palette` (with `chromeFg`, `dark`) into the tool layer.
- There is no span/expand control on the 2D card; only the 8 resize handles.

## Plan

### 1. Transparent drawing surface
- Stop passing `solidBody` for 2D and let the 2D card render with no panel background at
  all: only the thin header chrome and the drawing area stay, everything behind shows
  through (board colour, handwriting, formulas).
- Remove the workbench's own container fill so the canvas sits directly on the board.
- Keep pointer capture on the drawing area only, so board text underneath remains board
  content and is never covered by an opaque rectangle.

### 2. Ink inherited from the Smartboard
- `GeometryDiagram` gains an optional `stroke` prop (defaults to today's `#1f1f24`, so the
  Lesson Note is unchanged) that replaces the hardcoded default for points, lines, circles,
  arcs, curves, labels, measurements and angle values.
- `GeometryCanvas` and `GeometryWorkbench` thread that value through, and the board passes
  its current ink colour. White board with black writing → black geometry; black board with
  chalk-white writing → white geometry. Snap/hover helper marks stay their own accent so
  the teacher can still see what is being picked.
- Per-object colour selection in the right-hand inspector is untouched: it still overrides
  the inherited default for that one object (line → red stays red).

### 3. Span / expand control
Add a small span selector in the 2D card header, mirroring the Graph's expand behaviour:
**Small / Medium / Full**. Small and Medium set sensible fixed sizes; Full spans the
available board workspace. The card stays draggable and 8-handle resizable in every size,
and stays transparent at every size.

### 4. Side panels
Keep the two-panel layout (left tools, right diagram tools/inspector/undo-redo), each
independently collapsible as today, but make both panels read as floating chrome over the
board: they follow the board palette rather than a solid app-background block, so closing
them leaves a genuinely clear transparent drawing area.

### 5. Committed diagrams
The committed (merged) render also drops its wrapper surface and uses the inherited board
ink, so a completed diagram looks like it was drawn directly on the board.

## Technical notes

- `GeometryDiagram.tsx`: add `stroke?: string`, use it in `colourOf` and pass into
  `renderObject`; no change to existing call sites.
- `GeometryCanvas.tsx`, `GeometryWorkbench.tsx`: new optional `stroke` / `transparent` props.
- `BoardToolLayer.tsx`: drop `solidBody` for 2D, pass `palette`-derived ink, add the span
  actions (writing `width`/`height` through the existing `patch`, so span changes remain in
  the board's single undo history).
- `FloatingToolLayer.tsx`: allow a fully transparent body/shell variant for the 2D card.
- No changes to geometry tools, drawing behaviour, scene model, or the database.
