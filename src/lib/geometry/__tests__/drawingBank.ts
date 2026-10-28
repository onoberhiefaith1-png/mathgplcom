// GEOMETRY DRAWING BANK — the training range for the Engine's figures.
//
// Every entry is a real exam-style geometry question that REQUIRES a diagram.
// The harness (scripts/geometry-training/run.ts) asks the Engine to draw each
// one, compiles the construction exactly, verifies the finished figure and
// renders it to SVG for review. The same bank doubles as regression input.

export interface DrawingCase {
  id: string;
  family: string;
  question: string;
  /** Letters the finished figure MUST label. */
  requires?: string[];
}

export const DRAWING_BANK: DrawingCase[] = [
  /* ── circle theorems ─────────────────────────────────────────── */
  { id: "circ-centre", family: "circle theorems", requires: ["A", "B", "C", "O"],
    question: "In the diagram, O is the centre of the circle. A, B and C lie on the circle. Angle AOC = 110°. Find angle ABC." },
  { id: "circ-semicircle", family: "circle theorems", requires: ["A", "B", "C", "O"],
    question: "AC is a diameter of the circle with centre O and B lies on the circle. Show that angle ABC = 90°." },
  { id: "circ-cyclic-quad", family: "circle theorems", requires: ["A", "B", "C", "D"],
    question: "ABCD is a cyclic quadrilateral. Angle ABC = 85°. Find angle ADC." },
  { id: "circ-same-segment", family: "circle theorems", requires: ["A", "B", "C", "D"],
    question: "A, B, C and D lie on a circle. Angle ACB = 42°. Find angle ADB, giving your reason." },
  { id: "circ-alt-segment", family: "circle theorems", requires: ["A", "B", "C", "T"],
    question: "TA is a tangent to the circle at A. B and C lie on the circle. Angle BAT = 58°. Find angle ACB." },
  { id: "circ-two-tangents", family: "circle theorems", requires: ["A", "B", "O", "P"],
    question: "PA and PB are tangents from the external point P to the circle with centre O, touching it at A and B. Angle APB = 46°. Find angle AOB." },
  { id: "circ-tangent-radius", family: "circle theorems", requires: ["A", "O", "T"],
    question: "TA is a tangent at A to the circle with centre O. Show that angle OAT = 90°." },
  { id: "circ-chords", family: "circle theorems", requires: ["A", "B", "C", "D", "X"],
    question: "The chords AB and CD of a circle meet inside the circle at X. Show that triangle AXC is similar to triangle DXB." },
  { id: "circ-perp-chord", family: "circle theorems", requires: ["A", "B", "M", "O"],
    question: "O is the centre of the circle and AB is a chord. M is the midpoint of AB. Show that OM is perpendicular to AB." },
  { id: "circ-two-radii-triangle", family: "circle theorems", requires: ["A", "B", "O"],
    question: "OA and OB are radii of a circle with centre O and angle AOB = 70°. Find angle OAB." },

  /* ── triangles ────────────────────────────────────────────────── */
  { id: "tri-angle-sum", family: "triangles", requires: ["A", "B", "C"],
    question: "In triangle ABC, angle A = 52° and angle B = 61°. Find angle C." },
  { id: "tri-exterior", family: "triangles", requires: ["A", "B", "C", "D"],
    question: "In triangle ABC, BC is produced to D. Angle A = 48° and angle B = 65°. Find the exterior angle ACD." },
  { id: "tri-isosceles", family: "triangles", requires: ["A", "B", "C"],
    question: "Triangle ABC is isosceles with AB = AC and angle A = 40°. Find angle B." },
  { id: "tri-pythagoras", family: "triangles", requires: ["A", "B", "C"],
    question: "In triangle ABC, angle B = 90°, AB = 8 cm and BC = 6 cm. Find AC." },
  { id: "tri-sine-rule", family: "triangles", requires: ["A", "B", "C"],
    question: "In triangle ABC, angle A = 40°, angle B = 75° and AB = 9 cm. Use the sine rule to find BC." },
  { id: "tri-cosine-rule", family: "triangles", requires: ["P", "Q", "R"],
    question: "In triangle PQR, PQ = 7 cm, QR = 9 cm and angle Q = 62°. Use the cosine rule to find PR." },
  { id: "tri-similar", family: "triangles", requires: ["A", "B", "C", "D", "E"],
    question: "In triangle ABC, D lies on AB and E lies on AC with DE parallel to BC. AD = 4 cm, DB = 6 cm and DE = 5 cm. Find BC." },
  { id: "tri-altitude", family: "triangles", requires: ["A", "B", "C", "D"],
    question: "In triangle ABC, AD is the perpendicular from A to BC. AB = 13 cm, BD = 5 cm. Find AD." },
  { id: "tri-median", family: "triangles", requires: ["A", "B", "C", "M"],
    question: "In triangle ABC, M is the midpoint of BC. Draw the median AM." },
  { id: "tri-right-trig", family: "triangles", requires: ["A", "B", "C"],
    question: "In right-angled triangle ABC, angle B = 90°, angle C = 35° and BC = 12 cm. Find AB." },
  { id: "tri-congruent-pair", family: "triangles", requires: ["A", "B", "C", "D"],
    question: "In quadrilateral ABCD, AB = AD and CB = CD. Show that triangle ABC is congruent to triangle ADC." },
  { id: "tri-angle-bisector", family: "triangles", requires: ["A", "B", "C", "D"],
    question: "In triangle ABC, AD bisects angle A and D lies on BC. Angle B = 50° and angle C = 70°. Find angle ADB." },

  /* ── polygons & quadrilaterals ───────────────────────────────── */
  { id: "quad-parallelogram", family: "polygons", requires: ["A", "B", "C", "D"],
    question: "ABCD is a parallelogram with angle A = 68°. Find angle B." },
  { id: "quad-trapezium", family: "polygons", requires: ["A", "B", "C", "D"],
    question: "ABCD is a trapezium in which AB is parallel to DC, AB = 10 cm, DC = 16 cm and the height is 6 cm. Find its area." },
  { id: "quad-rhombus", family: "polygons", requires: ["A", "B", "C", "D"],
    question: "ABCD is a rhombus with diagonals meeting at X. Show that the diagonals cross at right angles." },
  { id: "quad-kite", family: "polygons", requires: ["A", "B", "C", "D"],
    question: "ABCD is a kite with AB = AD and CB = CD. Angle B = 100°. Find angle D." },
  { id: "quad-rectangle-diagonal", family: "polygons", requires: ["A", "B", "C", "D"],
    question: "ABCD is a rectangle with AB = 12 cm and BC = 5 cm. Find the length of the diagonal AC." },
  { id: "poly-pentagon", family: "polygons", requires: ["A", "B", "C", "D", "E"],
    question: "ABCDE is a regular pentagon. Find the size of each interior angle." },
  { id: "poly-hexagon", family: "polygons", requires: ["A", "B", "C", "D", "E", "F"],
    question: "ABCDEF is a regular hexagon with centre O. Find the size of angle AOB." },
  { id: "poly-exterior", family: "polygons", requires: [],
    question: "A regular octagon is drawn. Find the size of each exterior angle." },
  { id: "poly-quad-angle-sum", family: "polygons", requires: ["A", "B", "C", "D"],
    question: "In quadrilateral ABCD, angle A = 95°, angle B = 78° and angle C = 102°. Find angle D." },

  /* ── parallel lines ──────────────────────────────────────────── */
  { id: "par-corresponding", family: "parallel lines", requires: ["A", "B", "C", "D"],
    question: "The line AB is parallel to CD and a transversal crosses both. One corresponding angle is 64°. Find the other." },
  { id: "par-alternate", family: "parallel lines", requires: ["A", "B", "C", "D"],
    question: "AB is parallel to CD and a transversal cuts them. One of the alternate angles is 118°. Find the other." },
  { id: "par-cointerior", family: "parallel lines", requires: ["A", "B", "C", "D"],
    question: "AB is parallel to CD. A transversal makes a co-interior angle of 73° with AB. Find the co-interior angle at CD." },
  { id: "par-zigzag", family: "parallel lines", requires: ["A", "B", "C", "D"],
    question: "AB is parallel to CD. A zig-zag line runs from AB to CD making 35° with AB and 48° with CD. Find the angle at the bend." },
  { id: "par-perp-transversal", family: "parallel lines", requires: ["A", "B", "C", "D", "P"],
    question: "AB is parallel to CD and the line through P is perpendicular to AB. Show that it is also perpendicular to CD." },

  /* ── bearings, elevation & depression ────────────────────────── */
  { id: "bear-two-leg", family: "bearings", requires: ["A", "B", "C"],
    question: "A man walks 8 km from A on a bearing of 060° to B, then 6 km from B on a bearing of 150° to C. Find the distance AC." },
  { id: "bear-three-leg", family: "bearings", requires: ["P", "Q", "R"],
    question: "A ship sails 12 km from P on a bearing of 040° to Q, then 9 km on a bearing of 130° to R. Find the bearing of R from P." },
  { id: "bear-back-bearing", family: "bearings", requires: ["A", "B"],
    question: "The bearing of B from A is 075°. Find the bearing of A from B." },
  { id: "bear-elevation", family: "bearings", requires: ["A", "B", "C"],
    question: "A vertical pole BC stands on level ground. From a point A on the ground 20 m from the foot B, the angle of elevation of the top C is 32°. Find the height of the pole." },
  { id: "bear-depression", family: "bearings", requires: ["A", "B", "T"],
    question: "From the top T of a cliff 45 m high, the angle of depression of a boat B at sea level is 24°. Find the distance of the boat from the foot A of the cliff." },
  { id: "bear-two-elevations", family: "bearings", requires: ["A", "B", "C", "D"],
    question: "A tower CD stands on level ground. From A the angle of elevation of the top D is 28°, and from B, 30 m nearer the tower, it is 45°. Find the height of the tower." },

  /* ── arcs, sectors & shaded regions ─────────────────────────── */
  { id: "sect-area", family: "sectors", requires: ["A", "B", "O"],
    question: "A sector AOB of a circle of radius 7 cm has angle AOB = 120°. Find the area of the sector." },
  { id: "sect-arc-length", family: "sectors", requires: ["A", "B", "O"],
    question: "Find the length of the arc AB of a circle of radius 10 cm in which the angle AOB at the centre O is 72°." },
  { id: "sect-segment", family: "sectors", requires: ["A", "B", "O"],
    question: "In a circle of radius 8 cm the chord AB subtends an angle of 90° at the centre O. Find the area of the minor segment cut off by AB." },
  { id: "sect-shaded-triangle-circle", family: "sectors", requires: ["A", "B", "C"],
    question: "An equilateral triangle ABC of side 12 cm is drawn. The region inside the triangle is shaded. Find the shaded area." },
  { id: "sect-semicircle-region", family: "sectors", requires: ["A", "B", "O"],
    question: "A semicircle of diameter AB = 14 cm is drawn on the line AB with centre O. The semicircular region is shaded. Find its area." },
  { id: "sect-annulus", family: "sectors", requires: ["O"],
    question: "Two concentric circles with centre O have radii 5 cm and 9 cm. The region between them is shaded. Find the shaded area." },

  /* ── coordinate geometry ─────────────────────────────────────── */
  { id: "coord-two-points", family: "coordinate geometry", requires: ["A", "B"],
    question: "Plot A(1, 2) and B(5, 6) on the Cartesian plane and find the length of AB." },
  { id: "coord-midpoint", family: "coordinate geometry", requires: ["A", "B", "M"],
    question: "Plot the points A(-2, 3) and B(4, -1) and mark the midpoint M of AB." },
  { id: "coord-line-gradient", family: "coordinate geometry", requires: ["A", "B"],
    question: "Draw the line through A(0, -1) and B(4, 3) and find its gradient." },
  { id: "coord-triangle-area", family: "coordinate geometry", requires: ["A", "B", "C"],
    question: "The vertices of a triangle are A(0, 0), B(6, 0) and C(2, 5). Plot them and find the area of triangle ABC." },
  { id: "coord-perp-lines", family: "coordinate geometry", requires: ["A", "B"],
    question: "The line joining A(1, 1) to B(5, 3) is drawn. Draw the perpendicular to AB at A." },

  /* ── loci & constructions ───────────────────────────────────── */
  { id: "loc-perp-bisector", family: "loci and constructions", requires: ["A", "B", "M"],
    question: "AB = 8 cm. Construct the perpendicular bisector of AB, meeting AB at M." },
  { id: "loc-angle-bisector", family: "loci and constructions", requires: ["A", "B", "C"],
    question: "Angle ABC = 70° is drawn. Construct the bisector of angle ABC." },
  { id: "loc-perp-from-point", family: "loci and constructions", requires: ["A", "B", "F", "P"],
    question: "P is a point not on the line AB. Construct the perpendicular from P to AB, meeting AB at F." },
  { id: "loc-equidistant", family: "loci and constructions", requires: ["A", "B"],
    question: "A and B are 10 cm apart. Draw the locus of points equidistant from A and B." },
  { id: "loc-circle-locus", family: "loci and constructions", requires: ["O", "P"],
    question: "O is a fixed point. Draw the locus of a point P which moves so that OP = 4 cm." },
  { id: "loc-divide-segment", family: "loci and constructions", requires: ["A", "B", "P"],
    question: "AB = 12 cm is divided at P so that AP = 5 cm. Draw the divided line, marking both parts." },
  { id: "loc-produced-line", family: "loci and constructions", requires: ["A", "B", "C", "D"],
    question: "In triangle ABC, AB is produced to D. Angle CAB = 55° and angle ABC = 60°. Mark the angle CBD." },
];

export const DRAWING_FAMILIES = [...new Set(DRAWING_BANK.map((c) => c.family))];
