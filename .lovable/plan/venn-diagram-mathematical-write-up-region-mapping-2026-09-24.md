# Venn Diagram Mathematical Write-up & Region Mapping

## What is true today
- The Venn editor (`vennEngine/`) already handles sets, layouts, universal set, radius, border, fill, opacity, visibility and auto-layout. None of that is rebuilt.
- The model already stores region overrides keyed by the sets they contain: `"A"`, `"AB"`, `"ABC"`, `""` (outside). Each one holds free text and a fill. That is the semantic region model the new write-up will sit on.
- Today there is no list of set expressions. Values only reach regions through region overrides, and union expressions don't exist.

## What will be built

**1. One source of truth in the model**
- The existing region overrides stay as the store for physical regions: A only, B only, C only, A∩B only, A∩C only, B∩C only, A∩B∩C, and outside. Region keys are stable and never change when circles move, the radius changes, colours change or sets are renamed.
- A new `expressions` list holds everything that is not a single physical region: unions, "A ∩ B" in a three-set diagram (which includes the centre), and U. Each entry stores its set combination, operator and value.
- Old saved diagrams load unchanged. Missing fields default to empty.

**2. Expression generator**
- Built from the active sets, never from a fixed A/B/C list.
- Two sets: A only, B only, A ∪ B, A ∩ B, U.
- Three sets, in this order: A only, B only, C only, A ∩ B only, A ∩ C only, B ∩ C only, A ∪ B, A ∪ C, B ∪ C, A ∪ B ∪ C, A ∩ B, A ∩ C, B ∩ C, A ∩ B ∩ C, U.
- Only unique combinations are generated, so nothing like A ∩ A.
- Rows are labelled with the teacher's set names ("Mathematics ∩ Science"), so a rename updates every row at once. U only appears when the universal set is shown.
- Combinations the layout makes empty (for example A ∩ B when the sets are disjoint) are shown greyed out with an "empty in this layout" note.

**3. Right-hand panel: "Mathematical write-up" section**
- The panel order becomes Layout → Sets → **Mathematical write-up** → Style → Universal set.
- Every row has a free-text box that accepts numbers, x, 2x + 3, words or set expressions. There is no number checking.
- Typing edits the diagram straight away, with no separate Edit step.
- Focusing or clicking a row briefly highlights its regions on the diagram: one region for "only" rows, the whole combined area for unions, and the full boundary for U.

**4. Placing values on the diagram**
- Physical-region values are drawn at a computed spot inside their region, found by sampling the region and taking the point furthest from any edge.
- Union and pairwise-including-centre values are drawn as a labelled note (for example "Mathematics ∪ Science = 35") in a band next to the circles. They are never dropped into one region.
- U is drawn at the universal set's corner, and only when the boundary is shown.
- Empty rows draw nothing: no 0, no N/A, no placeholder box.

**5. Always readable, and the diagram grows instead of the text shrinking**
- The text keeps a fixed minimum size. If a value doesn't fit its region, the circles scale up. If it still doesn't fit, the value moves to a callout with a thin leader line.
- A collision pass keeps values clear of set names, other values and the diagram edges.
- The diagram's height is recalculated from its content, including the notes band. The note's own block grows with it, so the text below moves down and never overlaps.

**6. Editing on the diagram as well (two-way)**
- Double-clicking a value on the diagram opens a small in-place text box. Saving writes to the same stored field, so the panel row updates too. There is no second copy of the data.

**7. AI understands the structure**
- The Venn diagram directive and `diagramSpec` accept region values by meaning, such as `AB_only=7`, `A∩B=8`, `A∪B=35` and `U=50`, and write them into the correct field.
- The Co-Pilot and AI Edit standards get a Venn section that explains the difference between A ∩ B, A ∩ B only, A ∪ B, A only and A ∩ B ∩ C, and says they are never interchangeable.
- When AI Edit is working on a diagram, the diagram is described to it as structured data: sets, layout, regions and expressions. Commands like "put 8 in the Mathematics and Science intersection" or "change Mathematics to English" then come back as field updates, not a redrawn picture.
- AI-generated Venn diagrams (question stage blank, solution stage filled) use the same fields, so the teacher can edit them straight away.

## Out of scope
- One-set diagrams. The engine currently supports 2 or 3 sets, and adding 1 set would be a separate change.
- No change to the colour and style controls, the Smartboard or other diagram types.

## Technical notes
- `types.ts`: add `VennExpression { id, sets: SetId[], op: "union"|"intersect"|"universe", value }` and `expressions?: VennExpression[]`. Keep `RegionOverride.text` as the store for physical regions.
- New `vennEngine/expressions.ts`: `generateExpressions(model)`, `expressionRegions(expr, numSets)` (for example A∪B gives A, B, AB, AC, BC and ABC as applicable), `displayLabel(expr, sets)`, `isEmptyInLayout`.
- New `vennEngine/placement.ts`: region sampling with a pole-of-inaccessibility-style search, text measurement, a collision pass and `requiredSize(model)` to calculate the auto width and height.
- `VennEngineCanvas.tsx`: render the placed values, the notes band and the U value, plus a `highlight` prop and double-click inline edit.
- `VennEnginePanel.tsx`: the new section, placed between Sets and Style, sharing the highlight state with the canvas.
- `VennEngineNode.tsx`: the node height follows `requiredSize` so the document flow moves.
- `diagramSpec.ts` + `materializeDirectives.ts`: parse the semantic keys.
- `workspaceStandard.ts` / `upscalingStandard.ts` (notebook-ai): Venn semantics section, then redeploy.
- Tests: expression lists for 2 and 3 sets (no duplicates, renames update), union maps to multiple regions, A∩B differs from A∩B only, empty rows don't render, long labels increase the required size, and old models load.
