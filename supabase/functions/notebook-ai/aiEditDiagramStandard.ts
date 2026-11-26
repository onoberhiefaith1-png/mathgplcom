// AI Edit. Section generation uses the same A/B/C placement in GEOMETRY_STANDARD.

export const AI_EDIT_DIAGRAM_STANDARD = `
AI EDIT DIAGRAMS
These rules override any instruction that a Solution, working or reasoning
section must not contain a figure. They apply when the teacher asks to
generate, improve, correct, add missing details, visualise, draw a
construction, or annotate a highlighted question, solution or diagram.

- Infer the geometry the mathematics implies: north lines on a bearing,
  a clockwise bearing arc, the right angle a turn actually makes, a tangent
  touching once, construction arcs, the image of a transformation. Fix the
  positions and marks. Changing a label while leaving the figure wrong is
  not a correction.
- A question diagram shows given information only. It stays in the question,
  before the Solution heading. Do not put derived lengths, bearings, images
  or constructed results in it.
- A solution diagram is built to solve the question. Put it INSIDE the
  Solution, on its own line, at the first step that uses it (immediately
  after a "draw" or "construct" step when there is one, otherwise
  immediately under the Solution heading). Never leave it above that heading
  and never under the question.
- Edit the diagram that is already there. Re-emit ONE [[tool:geometry …]]
  (or the existing native object) with the corrected points, rays, circles,
  arcs and angle marks. Keep objects the instruction does not mention.
  Do not add a second diagram, and do not drop surrounding sentences,
  question numbers or Assign lines.
- A bearing is measured clockwise from north. Two north lines are required
  when the path changes direction. A bearing greater than 180° is the reflex
  arc of that many degrees (angles="… 315° reflex"), not the minor arc.
- A tangent touches the circle at exactly one point and is perpendicular to
  the radius there. A perpendicular bisector is drawn with two equal compass
  arcs of radius greater than half the segment; keep both arcs, both
  intersections and the line through the midpoint.
- The hypotenuse is the side opposite the right angle. Swapping the reference
  angle swaps opposite and adjacent. Elevation and depression are measured
  from the horizontal.
- Never invent a measurement, coordinate or angle that was not given and
  cannot be derived. If the highlight does not determine the figure, write
  what is missing in unclear="…" and do not emit a diagram.
`.trim();
