
# Graph Notebook — “Real Exercise Book” Rework

Scope is `src/components/lessonnotes/math-tools/SmartGraphView.tsx` and its attrs in `src/components/lessonnotes/extensions/SmartGraph.tsx`. No changes to other visuals.

## 1. Remove the X–Y data table
- Delete the entire sticky Data table block (the `<table>` at the top of the canvas).
- Delete the Undo/Redo/Clear history around `a.points` if only the table used it — keep undo/redo for the graph as a whole (points + shapes).
- Plotting a point still works via the “Plot” tool: click on the graph → point appears. No table row is created or shown.
- Point coordinate label next to the dot stays (small `(x, y)` label). If the user later says even that’s too much, we can drop it.

## 2. Four-sided Expand controls (+1 cm each)
Add four `+` buttons hugging the outside edges of the graph canvas:

```text
              [ + ]
        ┌──────────────┐
   [+]  │              │  [+]
        │    GRAPH     │
        │              │
        └──────────────┘
              [ + ]
```

Rules — one centimetre = **one major square** (5 minor subdivisions), which matches the current `SQ = 28 px` major grid.

- **Top (+)**: `squaresY += 1`, `originSquareY += 1`. Existing content stays anchored to the same data coordinates (origin moves down by one square), so the graph visually shifts down and a fresh row of paper appears on top.
- **Bottom (+)**: `squaresY += 1`. Origin unchanged. New paper appears below.
- **Left (+)**: `squaresX += 1`, `originSquareX += 1`. Content shifts right; new paper on the left.
- **Right (+)**: `squaresX += 1`. New paper on the right.

Because points are stored in **data coordinates** and rendered through `toPx` (which uses origin + scale), shifting the origin by one square preserves the visual position of every point/shape. Scale is untouched. This is expand, not zoom.

Also add a small `−` next to each `+` to trim an empty edge row/column (safety-clamped so we never crop below the outermost point).

Remove the “Grid columns / Grid rows / Origin X / Origin Y” fields from the More panel — those are now driven by the expand buttons. Keep X-label / Y-label there.

## 3. Expand vs Zoom (explicitly separate)
- The document-level zoom (existing header zoom slider on the notebook page) is the only “zoom”. It scales the whole page visually.
- The graph itself never zooms. `SQ` stays fixed at 28 px = 1 cm.
- Removes any inclination to conflate the two. The graph’s own toolbar has no zoom control.

## 4. Graph as the lesson-note surface (cursor insertion)
The graph should host arbitrary lesson-note objects, not just points and geometry shapes.

Pragmatic first pass (keeps state inside the SmartGraph node so undo/redo still works):

- Extend `SmartGraphAttrs` with a new array `overlays: OverlayItem[]`, where an item is:
  ```ts
  { id: string; kind: "text" | "formula" | "shape" | "triangle" | "circle" | "angle" | "image";
    x: number; y: number;                // in DATA coordinates, so expand doesn't move them
    payload: Record<string, unknown>;    // text, LaTeX, image src, shape params …
  }
  ```
- Add a **Cursor tool** (`+` icon) to the toolbar. When active, a large `+` marker follows the pointer over the graph and locks to the last click location. That locked position is the **insertion point**.
- Add an **Insert** dropdown next to the cursor tool with: Text, Formula, Triangle, Circle, Angle, Rectangle, Image. Choosing an item creates the corresponding overlay at the cursor position and immediately opens it for editing (e.g. contentEditable for text, a small LaTeX field for formula, sized shape for geometry).
- Each overlay renders as an SVG/foreignObject group at `toPx({x, y})` and is draggable by its handle. All overlays live in `attrs.overlays` so they persist through TipTap save and undo.
- Delete overlay: select it → keyboard Delete or a small × on the selection ring.

This gives the “write directly on graph paper” feel without embedding another TipTap editor inside the node (which would be a much larger refactor). If the teacher later needs paragraph-level flow inside the graph, we can upgrade `kind: "text"` overlays to a mini rich-text box.

## 5. Points, shapes, overlays all in data coordinates
Right now geometry shapes (`a.shapes`) are stored in **pixel coordinates**, which means expanding the graph would visually detach them. As part of this work, migrate `GraphShape.pts` to data coordinates (same as `GraphPoint`) and convert with `toPx` at render time. Old saved shapes (pixel-space) are converted on load using the current origin/scale.

## Technical details

- Files touched:
  - `src/components/lessonnotes/extensions/SmartGraph.tsx` — add `overlays` attr with `default: []`; extend `GraphShape` typing (data coords); keep migration comment.
  - `src/components/lessonnotes/math-tools/SmartGraphView.tsx` — remove data table; add four edge `+`/`−` buttons around the scrolling canvas; add Cursor tool + Insert dropdown; add overlay rendering + drag; convert shapes to data coords; drop grid/origin number fields from More.
- Keep the CSS surface (white, dark ink, yellow active) exactly as it is.
- Undo/redo history is repurposed to cover `points + shapes + overlays` as a single snapshot, so the “Undo” button behaves consistently after the table is removed.
- Coordinate labels next to plotted points remain (small `(x, y)`), because the data table used to be their only readout. This can be toggled off later if requested.

## Out of scope (call out to user)
- Embedding a full nested TipTap editor for prose inside the graph. Text overlays are single-field text; multi-line rich text can be a follow-up.
- Persisting overlays to any external table — everything stays inside the TipTap node attrs, same as points/shapes.
