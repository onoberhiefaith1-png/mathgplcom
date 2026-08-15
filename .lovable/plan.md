# Dynamic Lesson Notes: free typing, cursor-anchored insertion

Turn the lesson note from a stack of generated blocks into one continuous editable document, while leaving the diagram canvas exactly as it is.

## 1. Every generated line becomes directly editable

Today AI-generated math lines are inserted as sealed `mathBlock` objects. Double-clicking one opens the old mini editor: a symbol strip (½ x² √ + − × ÷ …), `⌫`, `clear`, "Enter saves · Esc cancels" and a **Done** button. That whole interface is removed.

New behaviour for a math line:

- Click it once — the text caret lands inside the line, at the character you clicked.
- Type, Backspace, Delete, retype, select, and continue typing normally.
- No palette, no Done button, no "Enter saves · Esc cancels" hint, no line-breaking pop-up.
- Leaving the line (click elsewhere, Tab, or arrow out) commits it; the rendered maths refreshes and autosave runs as usual.
- Backspace at the very start of a line joins it to the line above; Enter inside a line splits it, like a normal document.

Prose paragraphs and headings already accept the caret and keep working unchanged. Highlight + **AI Edit** stays exactly as it is — that remains the AI way to change text.

## 2. The extended page is one continuous canvas

After **Note Extend**, the added space behaves like the rest of the sheet:

- Clicking blank space below the last content places the caret there (a new empty line is created at that spot when needed).
- Double-click in the extended area opens a text/sensor box at that exact point.
- Sections, diagrams, tables and assets can all be inserted there.
- No invisible boundary at the original page bottom, and the area under a diagram stays clickable and typeable.

## 3. Insertion follows the caret — everywhere

The current rule ("a new section goes after the whole section that owns the caret") is removed. Replaced by:

> Text, sections, sessions and subtopics are inserted at the caret, immediately after the block the caret sits in.

So:

```text
Introduction
Some text…

[DIAGRAM]
| caret |            ← teacher clicks under the diagram

Section → Example   ⇒  Example lands here, under the diagram
```

If the caret is above the diagram, the section lands above it. The diagram never moves, and nothing jumps to the top of the page.

Applies identically to: Introduction, Explanation, Example, Exercise, Classwork, Homework, Summary, **Add Session** (Enter commits at the caret, With Solution still adds the Solution area, the typed name still drives AI generation) and **Add Subtopic** (inserted at the caret; it remains the AI context boundary for everything generated below it, with no With/Without Solution choice).

The caret position is remembered while the teacher is using the ribbon, so clicking a menu button never loses it.

## 4. Toolbar: remove the global Erase

**Erase** is removed from the main lesson-note toolbar. It stays where it belongs, inside the Diagram tools panel, and its segment-level behaviour (erasing `A-B` leaves `B-C`, `C-D`, `D-E` and any still-used shared points) is untouched.

## 5. Nothing else changes

Point, Line, Circle, Arc, Curve, Add Text, Add Angle, Add Area, Select, labels, line relationships, free diagram positioning, floating numbers, solutions, tables, graphs, assets, export and autosave all keep their current behaviour.

## Technical notes

- `src/components/lessonnotes/extensions/MathBlock.tsx`: delete the editing panel (symbol strip, `⌫`/`clear`, hint, Done) and the `open()` double-click/tap path. The node view renders the maths inside a `contentEditable` inline host so ProseMirror owns the caret; the node changes from `atom: true` to a text-holding node so click-to-caret, per-character editing, join-on-Backspace and split-on-Enter come from the editor itself. Value is written back on transaction, so the existing autosave and `syncDocumentToNotebook` paths are unchanged. `detectSelectionKind`, `exportDocx`, `solutionItems` and `aiToNodes` continue to emit/read `mathBlock` unchanged.
- `src/components/lessonnotes/DocumentEditor.tsx`: `sectionInsertPosition()` is rewritten to return the end of the block containing the caret (falling back to document end only when there is no caret). `insertSection`, `insertCustomSession` (drop the hardcoded `doc.content.size`) and `insertSubtopic` all use it. A `lastCaretRef` records `selection.to` on editor blur so ribbon clicks keep the position.
- `handlePaperMouseDown` / `handlePaperDoubleClick`: a click in blank space or in the `data-note-extend-spacer` region resolves to the nearest document position via `posAtCoords`, appending an empty paragraph when the click is past the last block, then focuses it. Geometry-mode short-circuits only while a diagram tool is actively drawing.
- Remove the Erase ribbon button (and its `geometryTool === "erase"` toggle) from `DocumentEditor.tsx`; `GeometryToolbar.tsx`, `DiagramToolsPanel.tsx`, `GeometryCanvas.tsx` and `sceneOps.eraseStructural` are left alone.
- No schema or edge-function changes.
