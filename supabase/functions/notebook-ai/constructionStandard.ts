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
{"op":"segment","a":"A","b":"B","distance":"8 cm","marks":"tick","dashed":false}
{"op":"vector","a":"A","b":"B","label":"a"}                       // arrowed segment
{"op":"path","points":["A","B","C"],"close":true}
{"op":"angle","vertex":"B","a":"A","b":"C","value":"58°","marker":"arc"}
{"op":"arc","circle":"c1","from":"A","to":"B"}
{"op":"sector","circle":"c1","from":"A","to":"B","area":"shaded sector"}
{"op":"shade","points":["A","B","C"],"area":"shaded region"}
{"op":"numberLine","from":-3,"to":5,"step":1,"marks":[{"value":2,"id":"P","label":"P"}]}
{"op":"axes","xMin":-5,"xMax":5,"yMin":-4,"yMax":6,"step":1}
{"op":"plot","id":"A","x":2,"y":3,"label":"A(2, 3)"}              // needs an "axes" step first
{"op":"text","near":"A","text":"tangent","dx":0,"dy":-18}

ORDER: construct points first, then draw segments/angles/arcs/shading.
ANGLES: degrees, measured anticlockwise from the positive x-direction.
HELPER POINTS: list ids you do not want lettered in "hide".

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
