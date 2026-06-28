# Integrate Geometry Editor into the Lesson Note

Replace the separate floating Geometry Editor panel with an **in-document** editing experience. The lesson note becomes the only workspace; geometry tools appear contextually when a diagram frame is selected.

## 1. Collapsible "Geometry Tools" Toolbar

Rebuild `GeometryToolbar.tsx` so the default state is a single collapsed header:

```text
▶ Geometry Tools
```

Click the chevron → expands to a vertical list grouped by category:

```text
▼ Geometry Tools
   Draw
     • Point
     ── Straight Line
     ⌒ Arc
   Shapes
     ◯ Circle
     △ Polygon
   Marks
     ∠ Angle
     ⊥ Perpendicular
     ∥ Parallel
     ≡ Equal Side
     □ Right Angle
   Measure
     A Label
     ↔ Measure
   Edit
     ✥ Move / Erase / Rotate
   AI
     ✎ Convert Sketch
```

Each row = **icon + readable name**. State (collapsed/expanded) persisted in `localStorage`. Inside each group, individual group headers are also collapsible (Radix `Collapsible`).

## 2. Word-Style Diagram Frame (TipTap NodeView)

Rewrite `GeometryDiagram.tsx` NodeView so each `geometryDiagram` node renders as a **framed object** in the document:

- **Idle:** thin `border-foreground/10` (almost invisible)
- **Hover:** faint blue tint
- **Selected** (TipTap `selected` prop): blue outline + 8 resize handles (corners + edges) + top-left move grip
- **Floating toolbar** above the frame on selection: AI Edit · Duplicate · Delete · Lock size

Frame attributes added to the node schema:
- `width` (px), `height` (px), `align` ("left" | "center" | "right"), `locked` (bool)

Resize handles drag → update `width`/`height` attrs. Move grip → standard TipTap drag (set `draggable: true` on the node).

## 3. In-Place Editing (no separate panel)

When the diagram frame is selected, the **Geometry Tools** panel docks to the right side of the document area (inside `DocumentEditor.tsx`), not a floating overlay. When selection moves away from any diagram, the panel auto-hides.

- Mount once in `DocumentEditor.tsx`
- Subscribe to the editor's selection updates; show panel when `editor.isActive('geometryDiagram')`
- The panel writes scene changes directly into the active node's attrs via `updateAttributes({ scene })`
- Save / Revert disappear — edits are live, with TipTap's native undo/redo handling history

The standalone `GeometryEditorPanel` portal is retired. `openGeometryEditor` becomes a no-op that simply selects the node.

## 4. Auto-Fit Frame

After every scene change:
- Compute SVG content bbox from the rendered scene
- If `locked === false`: set frame `width`/`height` to bbox + padding
- If `locked === true`: keep size, allow SVG to scale via `viewBox`

This prevents overflow when teachers add shapes, and shrinks back when content is removed.

## 5. Context-Aware Tools

- Geometry Tools panel is **hidden** when caret is in text
- Standard document toolbar stays visible always
- The "Diagram" dropdown in the doc toolbar keeps two actions: *Insert blank diagram* and *Convert sketch*

## 6. Drag, Duplicate, Delete

- Frame draggable across paragraphs via TipTap drag handle
- Duplicate button → `editor.chain().insertContent(currentNode.toJSON())`
- Delete button → `deleteNode()`
- Copy/paste works out of the box once the node serializes scene to `data-scene`

## Technical Outline

**Files changed:**
- `src/components/lessonnotes/extensions/GeometryDiagram.tsx` — add width/height/locked/align attrs, new NodeView with resize handles, selection ring, floating action bar
- `src/components/lessonnotes/geometry-editor/GeometryToolbar.tsx` — rewrite as collapsible sections (default collapsed), grouped, icon + label rows
- `src/components/lessonnotes/geometry-editor/GeometryEditorPanel.tsx` — convert from floating portal to a docked side panel component (`GeometryEditDock.tsx`) consumed by `DocumentEditor`
- `src/components/lessonnotes/DocumentEditor.tsx` — mount the dock, drive its visibility from selection, route scene updates to active node
- `src/components/lessonnotes/geometry-editor/useGeometryEditor.ts` — drop savedScene/dirty/save/revert; edits propagate live
- `src/components/lessonnotes/GeometryDiagram.tsx` (renderer) — expose content bbox callback for auto-fit
- Remove: the global `geometry-editor:*` event bridge and the floating portal mount

**Out of scope:** changing the underlying `GeometryScene` data model, AI Edit panel UX, sketch→geometry function.

Proceed?