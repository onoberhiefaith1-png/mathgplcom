# The Sensor becomes the master of the Lesson Note canvas

Today the sensor is the document caret. `placeCaretAtPoint` snaps every click to the nearest position in the flowing document (and a click near a diagram is forced to the position *after* that diagram). That is why the sensor slides to the right of a line, drops under the previous section, or refuses to sit in an empty area owned by a diagram. This changes the architecture, not the styling.

## New model

```text
LESSON NOTE CANVAS
├── Sensor            (free x/y, master insertion point)
├── Flowing content   (the existing note body)
├── Diagrams / graphs (free objects, unchanged)
└── Canvas frames     (free-positioned content created at the sensor)
```

The sensor no longer belongs to a section, a column, a plus region, or the text flow. It belongs to the page.

## 1. Sensor placement is spatial, not structural

- Double-click anywhere on the sheet — top-left, centre, right side, under a diagram, between two objects, inside the Note Extend area — and the sensor appears **at that exact point**. No snapping to a line, no jumping to the right edge, no dropping beneath the previous section.
- A double-click over blank space that a diagram merely overlaps still places the sensor there; the diagram no longer claims the surrounding emptiness.
- Clicking directly inside existing text still puts the normal text cursor in that text (unchanged), and the sensor follows it.
- The sensor stays exactly where it was put: it survives ribbon clicks, panel focus, autosave and AI writes, and is remembered per note so re-opening restores it.
- Visual: the same strong glowing caret, now drawn at the free coordinate.

## 2. Typing at a free sensor

Start typing (or press Enter) with a free sensor and a **canvas frame** is created at that coordinate: an unbordered block of lesson content that flows downward from the sensor. No dotted rectangle, no separate mini editor, no Done button — it is the same editing surface as the rest of the note, so math, symbols, AI Edit, highlight and autosave all behave identically.

Frames are ordinary content objects: they can be dragged to a new spot, they grow with their content, they never push or compress the flowing note, and an empty one disappears when left.

## 3. Insertion follows the sensor

- Introduction, Explanation, Example, Exercise, Classwork, Homework, Summary, Add Session (with or without Solution) and Add Subtopic all appear **at the sensor**.
- Sensor sitting in flowing text → inserted in the flow after that block (today's behaviour, kept).
- Sensor parked in free space → the section is created as a canvas frame beginning at that point, with its heading, body, and Solution area when requested. AI generation for it works exactly as now, including the typed session name as instruction and subtopic scoping.
- After an insertion the sensor parks at the start of the new body so the next insertion continues from there.

## 4. Diagrams and graphs stay independent

The sensor has no authority over them: inserting text or a section never moves a diagram, and diagrams/graphs are still created and dragged freely. Equally, a diagram no longer blocks the sensor from any region of the page.

## 5. Extended page

Identical behaviour end to end — free sensor placement, typing, frames and section insertion all work in the Note Extend region.

## Technical notes

- New TipTap node `canvasFrame` (block, `content: "block+"`, attrs `x`, `y`, `w`) in `src/components/lessonnotes/extensions/`. Its node view renders `position:absolute` at the stored paper-local coordinates with a `contentDOM`, so ProseMirror owns the caret, selection, math nodes and history inside it. Because frames are real document nodes, autosave, `syncDocumentToNotebook`, AI context, DOCX export and the notebook JSON need no new storage.
- `src/components/lessonnotes/DocumentEditor.tsx`
  - Sensor state becomes `{ mode: "doc"; pos } | { mode: "free"; x; y }`, persisted per notebook (same localStorage pattern as `canvas-boxes`).
  - `placeCaretAtPoint` splits into `placeSensorAtPoint`: hit-test the editor DOM first (a real text hit → doc mode); otherwise free mode at paper-local coords. Remove the `data-geometry-diagram-wrapper` → `after(pos)` branch and the "append paragraph at doc end" fallback.
  - `handlePaperDoubleClick` is the primary placement gesture; single click keeps placing the sensor but never creates content.
  - A free sensor mounts a hidden focusable input: first keystroke/Enter materialises a `canvasFrame` at `{x,y}` via `insertContentAt(doc.content.size, …)` and moves the selection into it.
  - `sectionInsertPosition()` gains a free branch that wraps the section nodes in a `canvasFrame`; `insertSection`, `insertCustomSession`, `insertSubtopic` and `moveSensorAfterInsert` route through it.
  - `SensorCaret` accepts either a doc position (`coordsAtPos`, as now) or free coords.
  - `CanvasBoxView` and `loadCanvasBoxes` stay as a read-only path so existing notes keep their old boxes; nothing new is created there.
- Frame dragging reuses the existing free-object drag pattern (pointer drag writing back `x`/`y` attrs), so it stays inside the document history.
- Untouched: `GeometryDiagram`, `NotebookGeometryOverlay`, `sceneOps` (segment erase), graphs/smart-graph, `MathBlock`/`MathInline` editing, PropertiesPanel, toolbar layout, edge functions and DB schema.
