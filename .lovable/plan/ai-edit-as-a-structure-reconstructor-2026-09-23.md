# AI Edit as a structure reconstructor

Goal: whatever goes into AI Edit (typed, pasted, a picture, a Co-Pilot result, an existing object) comes out as real, editable MathGPL objects. It is never pasted as a picture or flat text. Highlight → AI Edit → Accept keeps working exactly as it does today.

## What exists today
- AI Edit already turns tool instructions into real objects: Smart Table, Graph, 3D solid, Calculator, matrices and other maths structures (there are tests for matrices and tables).
- Diagrams only come from a named Asset Library shape (for example "right triangle"). A diagram that is described or drawn gets thrown away, and nothing is rebuilt in its place.
- The AI Edit button that opens on its own takes only text. It does not accept pictures.

## What gets built

1. **Pictures and files in AI Edit.** Add a "+" button to the AI Edit box (and allow pasting a screenshot) so the teacher can hand it a picture of a diagram, table, graph or full lesson. The picture is only read by the AI. It is never inserted into the note.

2. **Native geometry reconstruction.** Add a new "geometry" instruction. It describes points (with labels), segments, lines, rays, circles, arcs, angle marks (with a value or unknown like x), side lengths, and relationships such as parallel, perpendicular, equal and on-circle. The platform builds a real 2D Geometry scene from it, so labels are attached to their points and every part can be selected and edited. Relationships are kept as constraints, so parallel lines stay parallel.

3. **Question-aware and honest.** The AI gets the question text around the diagram, for example "AB is parallel to CD, find x". Every rebuilt diagram carries a confidence level. If something is low-confidence or a fact is missing, the preview shows a "Check this diagram" note that names what is unclear. Nothing is invented silently.

4. **Wider maths coverage.** Check and complete the conversion for fractions, powers, roots, integrals, sums, limits, logs, vectors, determinants, binomials, piecewise functions, simultaneous equations and symbols (≤ ≥ ≠ π θ ∞). Any gaps become native structures instead of text.

5. **Richer tables and graphs.** The table instruction gets headings, alignment, merged cells and maths inside cells. The graph instruction gets several equations, labelled points, scales and annotations, wherever the existing graph tool supports them.

6. **True duplication.** If an existing MathGPL object is selected and sent to AI Edit (diagram, table, graph, matrix or maths), AI Edit recognises what it is. "Duplicate" or small edits then work on the object's own data, not on a screenshot. The copy gets fresh ids, so editing it never changes the original.

7. **Co-Pilot goes through the same step.** Co-Pilot output uses the same conversion as AI Edit before it lands in the note. The result is the same objects either way.

8. **Whole lessons.** Pasting a full lesson gives a preview that shows each part as what it became (text, maths, geometry, table, graph, matrix). Accept inserts it all at the cursor.

## Acceptance tests (automated, then checked in the browser)
- Triangle with A, B, C, a 60° angle, a side length and an unknown x: rebuilt, duplicated, and every part stays editable on its own.
- Two parallel lines with a transversal: still parallel after duplication.
- 4×4 maths table: duplicated, and each cell edits on its own.
- Graph with a line and labelled points: duplicated, then edited.
- Matrix (2 3 / 4 5): duplicated, and each cell edits on its own.
- (x+3)/2, x², √(x+4), ∫₀¹x²dx, Σ s from 1 to 5: all stay structured.
- A full geometry lesson pasted in and accepted: the note contains only editable objects.
- Current Highlight → AI Edit → Accept tests still pass.

## Limits to be honest about
- Rebuilding from a blurry or messy photo depends on how well the AI can read it. Unclear parts are flagged, not guessed.
- Graph features the graph tool cannot do yet (for example shaded regions) are shown in the preview as not supported. They are not faked.

## Technical section
- `src/lib/lessonnotes/ai/toolManifest.ts`: add a `geometry` directive with a compact JSON spec (`points`, `segments`, `lines`, `rays`, `circles`, `arcs`, `angles`, `lengths`, `relations`, `confidence`, `unclear`). Extend `smartTable` (align, merge, header rows) and `graph` (multiple equations, points, ranges).
- New `src/lib/lessonnotes/ai/geometryFromSpec.ts`: spec → `GeometryScene` (via `src/lib/geometry/scene.ts` object types). Sensible default coordinates are derived from the relations and angle values; labels are bound to point ids. The output becomes a `geometryDiagram` node. Unit tests are added.
- `aiToNodes.ts` `splitDirectives`: handle `geometry`, carry `unclear` into a preview warning, and check structure coverage against `mathStructureLatex.ts` and the existing structure kinds.
- New `ai/objectSource.ts`: serialise a selected native node (geometryDiagram, mathVisual, mathStructure, mathTable) into an `[[object:…]]` payload. On Accept, deep-clone and strip ids (same approach as `insert.ts` `__instanceId`).
- `AiEditPanel.tsx`: attachment and paste-image input that feeds `material.images` (the backend already accepts images for other actions), plus a per-object preview with confidence badges.
- `supabase/functions/notebook-ai/index.ts`: send images to the AI Edit/compose action, add a reconstruction section to the prompt (question-aware, no invented facts, emit `unclear`), and run a validation pass (parallel and perpendicular relations must hold in the output). Update `workspaceStandard.ts` so diagrams must use `geometry`.
- Co-Pilot insertion path: run through `aiTextToNodes` with the same options (confirm the one place it bypasses this).
- Nothing changes in: QUESTION_LOCK, solution rules, Floating Numbers, Smartboard, or the right-hand Properties Panel editing rule.
