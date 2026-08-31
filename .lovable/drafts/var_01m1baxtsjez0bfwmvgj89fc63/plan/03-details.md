## What gets drawn

A bank of about 60 real exam-style figures, covering the geometry a teacher actually sets:

- Circle theorems — angle at centre, angle in a semicircle, cyclic quadrilateral, alternate
  segment, two tangents from an external point, chords and intersecting chords.
- Triangles — angle sums, exterior angle, isosceles marks, Pythagoras, sine/cosine rule
  figures, similar and congruent pairs.
- Polygons and quadrilaterals — parallelogram, trapezium, rhombus, kite, regular pentagon and
  hexagon, interior/exterior angle figures.
- Parallel lines cut by a transversal — corresponding, alternate, co-interior angles.
- Bearings and elevation/depression — north lines, three-leg journeys, angle of elevation.
- Arcs, sectors and shaded regions — sector area, segment area, region between shapes.
- Coordinate geometry — axes with plotted points, a line through two points, a circle.
- Loci and constructions — perpendicular bisector, angle bisector, foot of perpendicular,
  produced lines.

## Rounds

Each round: run the whole bank through the real Engine, compile, verify, render every figure
to an image, and assemble one contact sheet. Then read the failures, fix the cause, and run
again. Rounds continue while the pass rate is still moving.

Fixes land in three places, in this order of preference:

1. **The drawing standard** the Engine is given — the fastest and most durable fix. Worked
   patterns per family ("angle at centre: circle, centre O, two points on the circle, produce
   nothing"), an explicit rule that helper points are never lettered, and rules on where
   labels sit so they never land on a line.
2. **The compiler** — when the model asked for something legitimate that the compiler cannot
   solve or solves crookedly (e.g. tangents from an external point, segment shading, a
   sensible frame for wide bearing figures).
3. **The verifier** — when a bad drawing passed the checks. Every new failure mode seen on the
   contact sheet becomes a check, so it can never silently pass again.

Each fix arrives with a regression case, so a later round cannot undo an earlier one.

## Closing the second drawing path

The automatic per-section diagram path currently asks the model for raw pixel coordinates.
That path gets switched to ask for a construction program instead, so it is solved and verified
by the same compiler and verifier. Behaviour the teacher sees is unchanged — a section that
needs a figure still gets one automatically; it is just drawn properly. When a figure cannot be
constructed and verified, nothing is inserted rather than a wrong drawing.

## What you will see

A contact sheet of every diagram from the final round, plus a short per-family report of what
passed, what was fixed, and anything the Engine still cannot draw reliably.

## Technical notes

- Bank lives as a fixture file under `src/lib/geometry/__tests__/` so it doubles as regression
  input; the harness is a script that calls the deployed `notebook-ai` `mathengine` mode.
- Drawing pipeline unchanged in shape: `construction` →
  `src/lib/geometry/construct/compile.ts` → `src/lib/geometry/construct/validate.ts`.
- Standard text: `supabase/functions/notebook-ai/constructionStandard.ts` (worked patterns per
  family); `geometryStandard.ts` and the `geometry` mode in `index.ts` move to construction
  output.
- Rendering for review: a small headless scene-to-SVG writer for the harness only — the app's
  own diagram rendering is not touched.
- Honest limit: this is a finite set of live rounds inside this session, not unattended
  training, and every round spends AI credits.
