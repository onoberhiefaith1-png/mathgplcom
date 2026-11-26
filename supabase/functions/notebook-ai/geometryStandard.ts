// Standard injected into geometry-aware generation. Forbids ASCII pseudo-
// diagrams and explains the GeometryScene schema the model must emit when
// a section needs a diagram.

export const GEOMETRY_STANDARD = `
GEOMETRY DIAGRAM STANDARD

If a section's mathematical content describes a geometric figure (triangle,
circle, polygon, angle, parallel/perpendicular lines, tangent, chord, arc,
sector, transformation, locus, coordinate geometry, similarity/congruence,
construction, etc.), the diagram MUST be a real editable mathematical
figure — NEVER text characters, NEVER Unicode box-drawing, NEVER ASCII art
like

      /\\
     /  \\
    /____\\

ASCII shapes are strictly forbidden anywhere in your output.

When prose refers to "as shown", "the figure", "the diagram", "in the
diagram below", a diagram is REQUIRED. When the topic is naturally
geometric (circle theorems, tangents, triangles, similar triangles,
quadrilaterals, polygons, angles, transformations, Pythagoras, trigonometry
of triangles, loci, constructions, coordinate geometry of lines/circles), a
diagram is REQUIRED.

The diagram is produced separately as a GeometryScene JSON object — you do
NOT include it in your text response. Simply write the surrounding prose
naturally ("In triangle ABC, ..."), and the editor will insert the diagram
automatically alongside the text.

Do NOT write "(see diagram)" placeholder text. Do NOT draw any pseudo-figure
with slashes, underscores, dashes, or pipes. Just write the mathematics.

SECTION SEPARATION — THREE DIAGRAM PLACES
- A question diagram shows given information only. It stays in the question,
  before the Solution heading. Never put a derived length, bearing, image or
  constructed result on it.
- A solution diagram is built to solve the question. It belongs INSIDE the
  Solution, at the first step that uses it. It is never placed above the
  Solution heading and never left under the question.
- A teaching diagram sits beside the explanation of the concept it illustrates.
  It is not a copy of the question figure and it does not carry the answer.
- One role, one diagram. Do not draw a second question figure when the question
  already has its given diagram. A solution construction is a different diagram
  and may still be added inside the Solution.
- If the labels or measurements do not determine the figure, say what is missing
  and do not invent a diagram.

DIAGRAM OWNERSHIP RULE
- A question diagram stays with its question. A solution diagram stays with its
  Solution. A teaching diagram stays with its explanation.
- When a section already has a diagram of the same role, correct that diagram.
  Do not describe it as removed, and do not add a second one.
- Never write "the diagram has been removed" or "see new diagram".
- A solution figure found above the Solution heading is in the wrong place.
  Move it under the Solution heading, at the step that uses it. Do not leave it
  above the working.
`.trim();


export const GEOMETRY_SCENE_SCHEMA = `
GeometryScene = {
  "bounds": { "width": 320, "height": 220 },
  "objects": [
    { "id": "A", "type": "point", "x": 60, "y": 180, "label": "A" },
    { "id": "B", "type": "point", "x": 260, "y": 180, "label": "B" },
    { "id": "C", "type": "point", "x": 160, "y": 30,  "label": "C" },
    { "id": "AB", "type": "segment", "a": "A", "b": "B" },
    { "id": "BC", "type": "segment", "a": "B", "b": "C" },
    { "id": "CA", "type": "segment", "a": "C", "b": "A" },
    { "id": "angA", "type": "angle", "vertex": "A", "a": "B", "b": "C", "value": "60°" }
  ],
  "meta": { "topic": "triangle", "caption": "Triangle ABC" }
}

Object types (every object MUST have a unique "id" string):
  point     { id, type:"point", x, y, label?, labelOffset?, hidden? }
  segment   { id, type:"segment", a, b, label?, marks?: "tick"|"double"|"triple"|"right", dashed? }
  line      { id, type:"line",  a, b, dashed? }     // infinite line through a,b
  ray       { id, type:"ray",   a, b, dashed? }     // ray from a through b
  circle    { id, type:"circle", center, r, label?, dashed? }
  arc       { id, type:"arc",   center, r, from, to, dashed? }   // degrees, ccw from +x
  angle     { id, type:"angle", vertex, a, b, value?, marker?: "arc"|"double"|"right" }
  polygon   { id, type:"polygon", points:[ids], fill?, label? }
  label     { id, type:"label", x, y, text }

Coordinates: top-left origin, y grows DOWNWARD. Choose bounds.width and
bounds.height so the figure fits with at least 20-unit padding on every side.

Style: textbook clarity — neat, labeled, no clutter, no construction
debris. Use tick marks for equal sides, right-angle squares for 90°, and
small arcs for marked angles.
`.trim();
