# Clean generated diagrams: hide accidental construction points

## One correction first (verified in the code)

There is **no second diagram generator**. Every lesson-note diagram — above Classwork, between Classwork and Solution, anywhere — already comes from one path:

```text
question text -> notebook-ai (mode: "geometry") -> sanitizeScene -> geometryDiagram node -> the existing 2D renderer/editor
```

Confirmed:
- The only automatic generator is `notebook-ai` `mode: "geometry"`, called once from `DocumentEditor.tsx` after a question body is written.
- Solutions are explicitly blocked from generating a diagram (`isSolutionBlock` gate) and are instead told to reference the question's existing diagram by label.
- `geometry-sketch` (freehand sketch tool) and `geometry-edit` (AI edit of a selected diagram) are teacher-triggered tools, not generation paths.

So nothing needs deleting. The two diagrams in the screenshot are two `geometryDiagram` nodes rendered by the same engine: one belongs to the current question, the other is a leftover from an earlier generation of that section. That duplication and the stray `E, F, G, H, I, J` labels are the real defects, and both are fixable.

## Where the stray labels actually come from

The AI scene arrives with only the points the question names (P, Q, R, S). The extra labels are created **locally**: the moment the diagram node is opened/normalised, the editor runs the auto-intersection pass, which inserts a labelled point at every crossing of two chords and names it from the alphabet. Those points are already tagged `auto: true`, and points already support a `hidden` flag with a **Hide Point** control in the point properties panel.

So the fix is a visibility policy, not a new engine.

## What will change

### 1. Relevance pass on generated diagrams (new)
A small pure module that, given the scene plus the question text (and the solution text when it exists), decides which point labels are *required*:
- every label named in the question or solution text (`P`, `Q`, `R`, `S`, `∠QSR`, `QPR`, chord names like `QR`);
- every point that is an endpoint of a labelled segment/chord, a circle centre, or an angle vertex/arm;
- every point the teacher has explicitly edited (label typed, colour/size set, `auto` not set).

Everything else that is `auto: true` gets `hidden: true`. Geometry is never deleted — the crossing stays, the chords stay dissected, only the marker and its label stop rendering.

### 2. Apply it at the right moment (not in the drawing engine)
- On insertion of an AI-generated diagram in `DocumentEditor.tsx`, after `sanitizeScene`, and after the first normalise/intersection pass, so newly minted intersection points are hidden before the teacher ever sees them.
- Re-run when the owning question's text changes materially, so a point that becomes referenced later becomes visible again.
- The interactive drawing path (`useGeometryEditor.commit`) is **not** touched: while the teacher draws, intersections are still created and labelled exactly as today.

### 3. Hidden points must stay reachable
Today the live edit canvas ignores `hidden`, so hidden points are still fully drawn while a diagram is selected — which would make the clean-up look like it did nothing during editing. Change the live canvas to draw hidden points as faint "ghost" markers (small, low-opacity, no label) that remain clickable, so the teacher can select one and untick **Hide Point** to bring it back. Read-only rendering already hides them correctly.

### 4. One diagram per question
Tighten the existing ownership rule so a question section can only contain one diagram: when a new diagram is inserted for a question that already owns one, replace the old node's scene rather than adding a second node. This removes the "two diagrams stacked between Classwork and Solution" case in the screenshot.

### 5. Cleanup is undoable and manual control is untouched
The visibility pass is applied as part of the same undo step that inserts the diagram, so one Undo returns the raw diagram. Select point → Hide Point / label / colour / size / delete all keep working.

## Out of scope
No change to the drawing tools, the intersection algorithm, the AI prompt schema, or the renderer's geometry. No new diagram generator, and no new inline/quick renderer.

## Technical notes
- New: `src/lib/geometry/editor/relevance.ts` — `requiredPointIds(scene, text)` and `hideIrrelevantAutoPoints(scene, text)`, pure and idempotent.
- Reuses `matchElementIds` / label-matching ideas already in `src/lib/lessonnotes/diagramRef.ts`.
- `src/components/lessonnotes/DocumentEditor.tsx` — call the pass in the geometry insertion branch; reuse the existing question/solution text already gathered there for the prompt.
- `src/components/lessonnotes/geometry-editor/GeometryCanvas.tsx` — ghost rendering + hit-testing for `hidden` points.
- `src/components/lessonnotes/geometry-editor/useGeometryEditor.ts` — unchanged behaviour for drawing; only the first-mount normalisation of AI scenes routes through the pass.
