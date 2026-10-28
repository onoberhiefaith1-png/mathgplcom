// CONSTRUCTION STANDARD — 2D mathematics is CONSTRUCTED, never painted.
//
// The Engine must never invent pixel coordinates for a figure. It states what is
// mathematically true (this triangle has these angles, this point lies on that
// circle, this line is produced beyond that point) and the application solves the
// construction exactly, fits it to the frame, verifies it, and renders it as
// editable objects the teacher can then adjust.

export const CONSTRUCTION_STANDARD = `
DIAGRAM RULE — CONSTRUCT, DO NOT PAINT:
When a figure is needed you return a CONSTRUCTION PROGRAM, not coordinates.
The application computes exact positions from your program, so:
- never guess x/y for a vertex of a triangle, polygon or circle figure
- never place a point "near" a circle — declare it ON the circle
- never draw a produced/extended line as a separate segment — use "extend"
- never approximate a relationship: parallel, perpendicular and tangent have
  their own steps and are solved exactly
- every label you mention in the question text must exist as a constructed point
- NEVER letter a point the question does not name: list every helper point in "hide"

WORK IN THIS ORDER (diagram specification first, drawing second):
1. OBJECTS      — which mathematical objects exist (points, segments, circles…)
2. RELATIONSHIPS— what is true about them (P lies on AB, AB ∥ CD, ∠B = 90°)
3. LABELS       — only the letters and measurements the question uses
4. STEPS        — construct points first, then draw segments/angles/arcs/shading

CONSTRUCTION STEPS (use only these):
{"op":"triangle","ids":["A","B","C"],"angles":[50,60,70]}        // or "sides":[a,b,c] = BC,CA,AB
{"op":"rightTriangle","ids":["A","B","C"],"legs":[8,6]}          // right angle at B
{"op":"regular","ids":["A","B","C","D","E"]}                     // regular polygon
{"op":"quad","ids":["A","B","C","D"],"width":220,"height":140,"skew":0}
{"op":"circle","id":"c1","center":"O","r":110,"label":"O"}
{"op":"onCircle","id":"A","circle":"c1","angle":110}             // EXACTLY on the circle
{"op":"point","id":"O","x":0,"y":0}
{"op":"midpoint","id":"M","a":"A","b":"B"}
{"op":"onSegment","id":"P","a":"A","b":"B","t":0.4}
{"op":"extend","id":"E","a":"A","b":"B","by":0.4}                // AB produced beyond B
{"op":"foot","id":"F","p":"C","a":"A","b":"B"}                   // perpendicular foot
{"op":"intersect","id":"X","a":"A","b":"C","c":"B","d":"D"}
{"op":"parallel","id":"D","through":"C","a":"A","b":"B","by":1}   // CD ∥ AB, exactly
{"op":"perpendicular","id":"D","through":"P","a":"A","b":"B"}     // PD ⟂ AB, exactly
{"op":"tangentAt","id":"T","circle":"c1","at":"A"}                // AT is the tangent at A
{"op":"tangentFrom","ids":["A","B"],"circle":"c1","from":"P"}     // the TWO tangent points from external P
{"op":"polar","id":"B","from":"A","bearing":60,"distance":200}    // BEARINGS: clockwise from north
{"op":"polar","id":"C","from":"B","angle":32,"distance":180}      // anticlockwise from the +x direction
{"op":"north","at":"A"}                                           // dashed north arrow labelled N
{"op":"bisect","id":"D","vertex":"B","a":"A","b":"C"}             // a point on the bisector of ∠ABC
{"op":"line","a":"A","b":"B"}                                     // full line through A and B
{"op":"ray","a":"A","b":"B"}                                      // ray from A through B
{"op":"segment","a":"A","b":"B","distance":"8 cm","marks":"tick","dashed":false}
{"op":"vector","a":"A","b":"B","label":"a"}                       // arrowed segment
{"op":"path","points":["A","B","C"],"close":true}
{"op":"angle","vertex":"B","a":"A","b":"C","value":"58°","marker":"arc"}
{"op":"arc","circle":"c1","from":"A","to":"B"}
{"op":"sector","circle":"c1","from":"A","to":"B","area":"shaded sector"}
{"op":"shade","points":["A","B","C"],"area":"shaded region"}
{"op":"numberLine","from":-3,"to":5,"step":1,"marks":[{"value":2,"id":"P","label":"P"}]}
{"op":"axes","xMin":-5,"xMax":5,"yMin":-4,"yMax":6,"step":1}
{"op":"plot","id":"A","x":2,"y":3,"label":"A"}                    // needs an "axes" step first
{"op":"text","near":"A","text":"tangent","dx":0,"dy":-18}

ORDER: construct points first, then draw segments/angles/arcs/shading.

THE ONE RULE THAT BREAKS MOST FIGURES — DECLARE BEFORE YOU USE:
Every id you mention ANYWHERE (in a segment, angle, arc, path, shade, sector or
another step) must already have been created by an EARLIER step. There are no
implicit points. Only these steps create points: point, onCircle, onSegment,
midpoint, extend, foot, intersect, polar, parallel, perpendicular, bisect,
tangentAt, tangentFrom, triangle, rightTriangle, quad, regular, plot.
- "circle" creates NO point — its centre must already exist as its own "point".
- A circle id (c1) is a circle, never a point: never pass it to segment/angle.
- FORBIDDEN NAMES: never write an id such as "A_helper", "north_A", "P_helper",
  "H1", "P1", "B_line", "lineAB", "parallel_D_A_B_C". These are the single most
  common cause of a rejected figure. If you need such a point, create it with a
  point-creating step FIRST and list it in "hide"; otherwise do not mention it.
- Never draw a north arrow yourself: use {"op":"north","at":"A"}. It creates its
  own arrow and its own "N", so you never need a northern helper point.
- Two points must NEVER be constructed at the same place. If a point is already
  there, reuse its id. A chord must not be drawn through the centre unless the
  question says it is a diameter.


LABELS ARE SINGLE CAPITAL LETTERS:
A label is "A", "B", "O", "P" — never "A(2, 3)", never "8 cm", never a phrase.
Coordinates, measurements and words belong in "distance", "value" or a "text"
step. Every letter the question names must appear; nothing else is lettered.

ANGLES: degrees, measured anticlockwise from the positive x-direction.
HELPER POINTS: list ids you do not want lettered in "hide".

WORKED PATTERNS — follow the pattern for the family, do not improvise.

Angle at the centre / same segment / semicircle:
  point O → circle c1 centred O → onCircle A, B, C (keep them 90°–140° apart)
  → segments OA, OC, AB, BC → angle markers. Never place a point "near" the
  circle; always "onCircle".

Cyclic quadrilateral ABCD:
  point O → circle c1 → onCircle A(150), B(60), C(-20), D(210) in cyclic order
  → path A,B,C,D closed → angle markers. Hide O when the question never names it.

Tangent at a point (alternate segment, tangent ⟂ radius):
  point O → circle c1 → onCircle A → tangentAt T on c1 at A → segments A–T and
  O–A → angle OAT with marker "right" when it is the radius.

Two tangents from an external point P:
  point O → circle c1 (r 110) → point P about 260 from O → tangentFrom
  ids ["A","B"] circle c1 from P → segments P–A, P–B, O–A, O–B → angle APB.

Triangles: given angles → ONE "triangle" step with all three angles; given
sides → ONE "triangle" step with sides [BC, CA, AB]; right angle at B →
"rightTriangle". Then add markers. Never build a triangle from three "point"
steps.

Line produced / exterior angle:
  triangle A,B,C → extend D from B through C (by 0.4) → segment B–D → angle ACD.

Parallel lines with a transversal:
  point A → point B (that is line 1) → point C → parallel D through C along A–B
  (that is line 2) → the transversal joins two points you have CONSTRUCTED with
  "intersect" or "polar" — never invented ids → then the angle markers.

Bearings and elevation/depression — always "polar":
  point A → north at A → polar B from A bearing 60 distance 200 → north at B →
  polar C from B bearing 150 distance 150 → segments A–B, B–C, A–C.
  A back bearing needs a north arrow at BOTH ends: {"op":"north","at":"A"} and
  {"op":"north","at":"B"} — nothing else, no helper point, no extra segment.
  Elevation: point A → point B on the same horizontal → perpendicular C through
  B relative to A–B → segments A–B, B–C, A–C → angle at A, marker "arc".
  Depression: the horizontal at the TOP point T is a "polar" point H from T with
  angle 0 (list H in "hide") → segment T–H dashed → angle from H down to the
  object. Never name a horizontal helper "H_horizontal" without constructing it.
  A transversal crossing two parallels: construct BOTH crossing points with
  "intersect" of the two named lines before you mark any angle at them.


Sector, arc and segment of a circle:
  point O → circle c1 → onCircle A, B → sector c1 from A to B (draws both radii,
  the arc and the shading). For a minor SEGMENT: sector plus segment A–B, or
  "shade" over points that already exist. Never shade ids that do not exist.

Coordinate geometry:
  "axes" first, with xMin/xMax/yMin/yMax comfortably covering every point →
  "plot" each point with its LETTER as the label; the coordinate pair is printed
  beside it automatically. Never plot two points at the same place, and never
  plot on the origin unless the question puts a point there.

Loci and constructions:
  perpendicular bisector: point A → point B → midpoint M → perpendicular P
  through M relative to A–B → line through M and P, dashed.
  angle bisector: construct the angle, then "bisect".

WORKED EXAMPLE — the minimum quality standard.
Question: "AB = 12 cm is divided at P so that AP = 5 cm."
Specification: points A, P, B; segment AB; P lies on AB with AP : PB = 5 : 7;
labels A, P, B and the two distances.
"construction": { "figure": "segment AB divided at P", "steps": [
  {"op":"point","id":"A","x":0,"y":0},
  {"op":"point","id":"B","x":300,"y":0},
  {"op":"onSegment","id":"P","a":"A","b":"B","t":0.4167},
  {"op":"segment","a":"A","b":"P","distance":"5 cm"},
  {"op":"segment","a":"P","b":"B","distance":"7 cm"}
], "hide": [] }

2D ONLY:
This engine constructs 2D mathematics only. If the question needs a solid
(cube, cuboid, cylinder, cone, sphere, prism, pyramid), return
"construction": null and name the existing MathGPL 3D asset instead, e.g.
"asset3d": "cylinder". Never attempt a 3D figure through construction steps.

Return the program as:
"construction": { "figure": "circle with cyclic quadrilateral ABCD", "steps": [ ... ], "hide": [] }
Return "construction": null when the question needs no figure.
`.trim();
