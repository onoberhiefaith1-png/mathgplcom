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

DIAGRAM OWNERSHIP RULE
- A geometry diagram inserted under a section belongs to that section forever.
- It sits between the section heading and the next heading. Treat it as part
  of the question/explanation it illustrates.
- When editing a section that already has a diagram, you are editing the PROSE
  only. Do not describe the diagram as removed, replaced, or moved.
- Never write "the diagram has been removed" or "see new diagram" — the
  diagram node is preserved automatically by the editor.
- When a NEW section is added below a section with a diagram, that new section
  must appear BELOW the existing diagram. Never produce content that implies
  the previous diagram should be discarded.
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
