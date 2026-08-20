// CONSTRUCTION STANDARD — 2D mathematics is CONSTRUCTED, never painted.
//
// The Engine must never invent pixel coordinates for a figure. It states what is
// mathematically true (this triangle has these angles, this point lies on that
// circle, this line is produced beyond that point) and the application solves the
// construction exactly, fits it to the frame, and renders it as editable objects.

export const CONSTRUCTION_STANDARD = `
DIAGRAM RULE — CONSTRUCT, DO NOT PAINT:
When a figure is needed you return a CONSTRUCTION PROGRAM, not coordinates.
The application computes exact positions from your program, so:
- never guess x/y for a vertex of a triangle, polygon or circle figure
- never place a point "near" a circle — declare it ON the circle
- never draw a produced/extended line as a separate segment — use "extend"
- every label you mention in the question text must exist as a constructed point

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
{"op":"segment","a":"A","b":"B","distance":"8 cm","marks":"tick","dashed":false}
{"op":"path","points":["A","B","C"],"close":true}
{"op":"angle","vertex":"B","a":"A","b":"C","value":"58°","marker":"arc"}
{"op":"arc","circle":"c1","from":"A","to":"B"}
{"op":"shade","points":["A","B","C"],"area":"shaded region"}
{"op":"text","near":"A","text":"tangent","dx":0,"dy":-18}

ORDER: construct points first, then draw segments/angles/arcs/shading.
ANGLES: degrees, measured anticlockwise from the positive x-direction.
HELPER POINTS: list ids you do not want lettered in "hide".

Return the program as:
"construction": { "figure": "circle with cyclic quadrilateral ABCD", "steps": [ ... ], "hide": [] }
Return "construction": null when the question needs no figure.
`.trim();
