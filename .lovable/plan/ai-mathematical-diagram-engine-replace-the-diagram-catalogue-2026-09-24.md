# AI Mathematical Diagram Engine — replace the diagram catalogue

## What is true today
- The Asset Library's "Parametric Vector Diagrams" section is a catalogue of fixed tiles (Line segment, Triangle (isosceles), Venn 2-set, Cube, Tree, Flowchart…), defined in `src/lib/lessonnotes/assets/diagrams.ts` and shown in `AssetLibraryDialog.tsx`.
- Behind those tiles the project already has real construction engines: Venn (with a region solver), Tree, Flowchart, Organisation, Circle, Line, Solid (3D), plus the 2D geometry construction compiler.
- The AI does not use those engines directly. For sets/Venn, the directive materializer (`materializeDirectives.ts`) searches the Asset Library for "venn diagram" and drops in the stock tile, and other diagram types fall back the same way. That is the behaviour you described, and it is the thing to replace.

## What will be built

**1. One Diagram Engine entry point**
A single `diagramSpec` (type + mathematical data) that the AI writes and the engine builds from. Supported types: `venn`, `tree`, `flowchart`, `logic/hierarchy`, `geometry2d` (lines, angles, triangles, quadrilaterals, polygons, circle parts), `solid3d` (cube, cuboid, cylinder, cone, sphere, pyramid, prism, nets). Each type is turned into its existing editable node, filled in from the data. Nothing is looked up from the Asset Library.

**2. Venn diagrams built from the mathematics**
- Input: set labels, universal total, the known counts ("40 students, 25 Maths, 18 Science, 10 both") and/or an operation (A ∩ B, A ∪ B, A′, A − B, disjoint, subset).
- The solver works out every region (Maths only 15, both 10, Science only 8, neither 7), picks the layout (overlap, disjoint, subset, 3-set), writes the values into regions and shades only the region the operation asks for.
- The result is the existing editable Venn node, with Sets, labels, region values and shading changed in the right-hand Properties Panel.

**3. Tree diagrams and flowcharts built from the problem**
- Tree: events + outcomes (+ probabilities) → branches, labelled branch values, and a final list of outcomes (HH, HT, TH, TT).
- Flowchart: steps and decisions → Start/Input/decision/action/End boxes with Yes/No arrows.

**4. Geometry and 3D from properties**
The existing construction compiler builds 2D figures from their properties (equal sides, parallel, tangent, radius 5 cm with diameter marked). 3D solids use the stated dimensions (8 × 5 × 3 cuboid) with labelled edges.

**5. Question diagram vs Solution diagram**
Using the existing Question → Solution session pairing:
- Classwork N gets the question's diagram (blank regions/branches where the student must work it out).
- Solution N gets the completed diagram generated from the worked solution (values, shading, probabilities filled in).
The one-diagram-per-question rules for geometry stay. Venn, tree and flowchart get a separate "completed" copy only in the Solution.

**6. AI training**
The Co-Pilot, AI Edit (upscaling) and the lesson generator are told: understand the object, then construct it with `diagramSpec`. They must never ask the Asset Library for a mathematical diagram. The intent rules come from your examples: overlapping groups → Venn; "outcomes of tossing twice" → tree; "process for deciding…" → flowchart; "three equal sides" → equilateral triangle. The server check rejects a draft that asks for a mathematical diagram as an asset, and retries it once.

**7. Asset Library cleanup**
- The whole "Parametric Vector Diagrams" section is removed from the Asset Library and its search, so mathematical diagrams can no longer be picked as assets.
- Teachers still need a manual way in, so the editor's Diagram button gets a short menu: Venn, Tree, Flowchart, 2D Geometry, 3D Solid, plus "Describe it…". "Describe it…" is a box where the teacher writes "circle with a chord and tangent" and the engine builds it. Each option opens a blank, editable engine diagram.
- The Asset Library keeps what really are assets: symbols, structures, illustrations, real-world images, manipulatives, backgrounds and teacher uploads.

**8. Existing notes stay safe**
Diagrams already saved in lesson notes keep displaying and stay editable. Only the library tiles go; the engines that draw them stay.

## Out of scope
- No new drawing library.
- No change to the Smartboard's 2D/3D workbench or the Game.
- Smart Tables and Graphs keep their own tools. They are not asset tiles.

## Technical notes
- New: `src/lib/lessonnotes/ai/diagramSpec.ts`, which parses the spec and turns each type into its engine's node attrs (Venn `UCEVennModel` + `regions`, tree/flowchart models, geometry via `geometryFromSpec`/construct compile, solid via solidEngine).
- New: a Venn region solver from counts/operations, reusing `vennEngine/solver.ts` and `regions.ts`.
- Edit `materializeDirectives.ts`: `venn/sets/tree/flowchart/solid/diagram` go to `diagramSpec`, and the `assetNode` fallback is removed for mathematical kinds.
- Edit `toolManifest.ts`: add the `diagram` tool and drop the diagram asset entries from the AI manifest.
- Edit `registry.ts` / `AssetLibraryDialog.tsx`: stop showing and searching `DIAGRAMS`. Keep the render definitions so saved nodes still work.
- Edit backend: `workspaceStandard.ts`, `upscalingStandard.ts` and `sessionStructureStandard.ts` get a diagram-construction section and a violation check for "diagram requested as asset". Redeploy `notebook-ai`.
- Edit `DocumentEditor.tsx`: attach the completed Venn, tree or flowchart to the Solution N section, next to the existing question-diagram insertion.
- Tests: the class-of-40 example gives 15/10/8/7; A∩B shades only the overlap; disjoint sets do not overlap; two coin tosses give 4 outcomes; the even-number flowchart has one decision; the 8×5×3 cuboid has its dimensions labelled; no mathematical kind resolves to an Asset Library entry.

## Verification
Use AI Edit on a lesson with the class-of-40 Classwork. Expected result: Classwork 1 shows a two-set Venn with the labels Mathematics and Science. Solution 1 shows the completed Venn with 15, 10, 8 and Neither = 7, and every value can be edited in the Properties Panel. Then check that the Asset Library no longer lists any diagram tiles, and that an older note containing a Venn still opens correctly.
