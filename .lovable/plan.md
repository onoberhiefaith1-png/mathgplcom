# Persistent insertion cursor (sensor) for lesson notes

Goal: one strong, always-visible insertion cursor that owns where text and sections go, while diagrams and graphs stay free objects.

## 1. Retire the dotted rectangle

Today a double-click on blank paper spawns a small free-floating text box (`CanvasBoxView`) with a dashed border and its own textarea — that is the weak "sensor" in the screenshot. It is not part of the document, so nothing inserted from the ribbon can land at it.

- Blank-paper double-click no longer spawns that box; it places the document cursor at that spot (same as a single click) so the teacher types straight into the note.
- Existing saved boxes keep rendering so no current note loses content, but no new ones are created.
- The dashed rectangle styling disappears with them.

## 2. A visible, persistent sensor

The document caret becomes the sensor and gets a real presence:

- A thicker, ink-coloured caret with a soft glow (same visual language as the Smartboard writing sensor) so the teacher can always see where insertion will happen.
- It stays visible even when focus moves to the ribbon: while a ribbon menu is open, a "held" caret marker is drawn at the remembered position instead of vanishing.
- It can be placed anywhere in the editable area: inside text, on an empty line, in the gap under or beside a diagram, and anywhere inside the Note Extend region.
- Clicking existing text just puts the cursor in it — no separate editor, no Done button (already the case for prose and math lines; kept).

## 3. Insertion always happens at the sensor

Verified in code: section insertion already reads a remembered caret and inserts after the block containing it. The remaining failure is that in several paths the caret is never actually moved to where the teacher clicked (clicks that land on the diagram node view, the geometry overlay, or the extend spacer), so the remembered position is stale — usually the top of the note — and the new section appears above the diagram.

Fixes:

- Blank-space and spacer clicks resolve to a real document position; when the click is past the last block, an empty paragraph is appended there first and the cursor goes into it.
- A click in the margin around a diagram resolves to the position *after* that diagram rather than selecting the diagram or leaving the caret untouched.
- The remembered position is only ever overwritten by a genuine user selection change, never by autosave, AI writes, or panel focus.
- After an insertion, the sensor moves to the start of the newly inserted block, so a following Add Session/Section continues downward instead of jumping back.

Applies to: Text, Introduction, Explanation, Example, Exercise, Classwork, Homework, Summary, Add Session, Add Subtopic, and text-based assets/symbols/math inserted from the ribbon.

## 4. Diagrams and graphs stay independent

No change to how diagrams, geometry or graphs are created, dragged or positioned. The sensor has no authority over them: inserting text or a section never moves a diagram, and creating a diagram is not forced to the sensor position.

## 5. Extended page

The extended region is treated as the same editable surface end to end — sensor placement, typing, and section insertion all work there exactly as on the original sheet.

## Technical notes

- `src/components/lessonnotes/DocumentEditor.tsx`
  - `handlePaperDoubleClick`: drop `spawnCanvasBoxAt`; delegate to the same caret-placement routine as `handlePaperMouseDown`.
  - Extract a shared `placeCaretAtPoint(clientX, clientY)`: `posAtCoords` → if inside/adjacent to a `geometryDiagram` node use `after(pos)`; if no hit (spacer / below last block) append an empty paragraph at `doc.content.size` when the last child is not already an empty paragraph, then `setTextSelection`.
  - `lastCaretRef`: keep updating on `selectionUpdate` only (drop the `update` listener so programmatic doc writes don't move it), and add a `sensorPos` state mirror for rendering the held marker.
  - After `insertSection` / `insertCustomSession` / `insertSubtopic`, set the selection into the new paragraph and update `lastCaretRef`.
  - Render a `SensorCaret` overlay (absolute, positioned from `editor.view.coordsAtPos(sensorPos)`) shown when the editor is blurred but a sensor position exists.
  - Keep `CanvasBoxView` and the persisted `canvasBoxes` read path; remove only the creation path.
- `src/styles.css`: strong caret style for `.lesson-doc .ProseMirror` (`caret-color`, ~2px effective width via caret colour + the overlay marker) and the sensor glow class.
- Untouched: `GeometryDiagram`, `NotebookGeometryOverlay`, `GeometryToolbox`, `sceneOps`, graph/smart-graph components, `MathBlock` editing model, autosave and `syncDocumentToNotebook`.
- No schema or edge-function changes.
