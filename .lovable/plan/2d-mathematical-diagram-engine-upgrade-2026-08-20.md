# 2D Mathematical Diagram Engine — upgrade

The diagram in the screenshot is bad for two reasons found in the code, not because the mathematics is hard:

1. The Math Engine already returns a **construction program** which is compiled and verified locally (`src/lib/mathengine/client.ts` builds a scene from it), but the lesson-note question path throws that scene away: `engineGenerate` in `src/components/lessonnotes/DocumentEditor.tsx:368-410` returns only `q.text` / solution steps and never the `scene`. So diagrams reaching the note do not come from the construction engine at all.
2. Where a construction is compiled, label placement in `src/lib/geometry/construct/compile.ts:284-300` pushes every letter away from the figure's centroid. For a collinear figure (A — P — B) the centroid lies on the line, so the letters are pushed *along* the line and sit on the segment and on each other.

## What will be built

**1. The Engine's constructed diagram becomes the question's one authoritative diagram**
`engineGenerate` returns `{ text, scene }`. When a question section is generated and the Engine produced a verified scene, the editor inserts it as a `geometryDiagram` node at the end of the question body (above the Solution heading), reusing the existing ownership rules: one question = one diagram, no diagram beside the Solution, existing diagram reused rather than duplicated. Solutions still receive only the inventory of the existing diagram.

**2. Textbook label placement in the compiler**
Label direction is chosen as the widest gap around each point: away from every edge meeting it, away from close neighbours, with a mild outward and below-the-figure preference. Collinear figures get letters clear of the line; triangle/circle figures keep their current outward placement.

**3. More verified 2D constructions**
New construction steps so common diagram types are constructed rather than approximated: `numberLine`, `axes` (with optional grid), `vector` (arrowed segment), `parallel` (point/line parallel through a point), `perpendicular` (line at 90° through a point), `tangent` (from a point or at a point of a circle), `sector` and `semicircle`. Each is solved exactly, so parallel really is parallel and a tangent really touches.

**4. Stricter diagram quality gate**
`src/lib/geometry/construct/validate.ts` gains checks for label collisions (letter boxes overlapping each other or lying on a segment), figure clipping, declared-parallel/perpendicular relations, and closed polygons. Failures already trigger one bounded regeneration in the Engine client; that stays, so a known-bad figure is never shown.

**5. Backend construction discipline**
`supabase/functions/notebook-ai/constructionStandard.ts` is extended with: the diagram-specification discipline (state objects, relationships, labels before drawing), a worked line-segment example (`A — P — B` with `AB = 12 cm`, `AP = 5 cm`), the new steps, the rule that only labels named in the question are lettered, and an explicit **2D only** rule — a 3D figure returns a named existing MathGPL 3D asset directive instead of a construction.

## Out of scope

No JSXGraph or MathJax dependency: the project already has a construction → exact coordinates → editable SVG `GeometryScene` pipeline with its own editor, and swapping renderers would break teacher editing. No change to the 3D system, and the AI never drives the teacher's manual 2D editor.

## Technical notes

- `src/components/lessonnotes/DocumentEditor.tsx` — `engineGenerate` return shape; insert the constructed scene at `questionBodyEnd` with a fresh `diagramId`, guarded by `diagramsOwnedByQuestion`.
- `src/lib/geometry/construct/compile.ts` — label placement; new step solvers.
- `src/lib/geometry/construct/types.ts` — new `ConstructionStep` variants.
- `src/lib/geometry/construct/validate.ts` — label/relation/clipping checks.
- `supabase/functions/notebook-ai/constructionStandard.ts` — the standard text.

## Verification

Generate an example whose question is "AB = 12 cm is divided at P so that AP = 5 cm": expect one diagram under the question with a straight segment, a visible interior point P, letters A, P, B clear of the line, dimension marks, and no second diagram beside the Solution. Then a circle-theorem example: points exactly on the circle, angle markers with real arms, no unlettered helper points.
