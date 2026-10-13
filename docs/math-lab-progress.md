# Math Lab progress

| Stage | Status | Notes |
|---|---|---|
| 0 Separate app, 2D/3D/ND, library | done | Lesson Note / Smartboard graph untouched |
| 1 Rename + shared equation reader | done | `/math-lab`, `/graph` redirects; reader handles fractions, powers, √, trig, logs, \|x\|, π, 2x, clear errors |
| 2 Smart entry + auto-plotting | done | Auto 2D/3D classification; implicit 2D and planar parametric plots; parabola roots/vertex framing; fit/reset with equal scales and bounded zoom; in-place equation edit, comparison, visibility and removal. 22 tests pass; signed-in desktop plotting/edit/hide/show/remove/fit verified without runtime errors. Real-device touch verification remains outstanding. |
| 3 Matrices, calculus and saving (revised scope) | done | 2×2/3×3 operations, transformed square, symbolic derivative, tangent, checked numerical integral, account/workspace-scoped device saves with export/import. 33 tests pass; signed-in desktop save/reload/open, rename/delete, export/import and calculation workflows verified. Cloud synchronisation is not included. |
| Remaining original roadmap stages | planned | Original library/guided-lesson expansion and advanced matrices/calculus remain future work; this phase follows the approved revised scope. |

## Stage 2 significance

- **Teachers:** enter, edit and compare equations without preparing a table of values or repeatedly choosing a plotting window.
- **Students:** connect equations to curves, surfaces and points; compare shifted parabolas, roots and turning points, and see circles without rearranging them into separate functions.
- **Problem solved:** automatic classification and framing reduce setup mistakes and clipped plots; equal axis scales prevent circles looking like ellipses.
- **Real-world purpose:** develop graph-reading and model-comparison skills used in engineering, data analysis and scientific visualization.
- **Beyond traditional paper plotting:** immediate, reversible equation changes make relationships visible without redrawing; the mathematics runs locally without AI calls.

## Stage 3 significance

- **Teacher capability:** edit matrices, demonstrate transformations, compare curves with derivatives and tangents, calculate definite integrals and save named demonstrations for future lessons.
- **Student learning:** connect determinant with area scaling, derivatives with rate of change, and definite integrals with signed accumulation. Singular matrices and undefined tangents are reported rather than hidden.
- **Real-world purpose:** transformations support graphics and robotics; rates and accumulation support motion, growth and measurement; portable saved demonstrations support repeatable teaching.
- **Beyond traditional methods:** immediate calculation and linked plots reduce repeated arithmetic and redrawing without AI generation. Device saves reopen after reload; JSON backups transfer graphs without mixing accounts or workspaces.
- **Verification limits:** numerical integrals are approximations with an estimated error, not symbolic proofs. Signed-in desktop workflows were verified; real-phone touch testing and automatic cross-device cloud synchronisation are not included.

## Stage 4 — Calculus inside Math Lab (done)
Derivative tab: live gradient explorer slider with moving tangent, f′ and f″ working, plot f′, keep tangent. Integral tab: exact polynomial antiderivatives (+ C), definite integrals (exact for polynomials, otherwise labelled ≈), area between two curves, Riemann strips (left/right/midpoint/trapezium) drawn on the graph. Analysis tab: stationary points (max/min/stationary inflection), inflection points, numerical limits from both sides with continuity and removable-discontinuity verdicts. Parameter `a` slider explores function families. Significance: students see the gradient change as they move along a curve and watch Riemann sums converge, instead of memorising rules. Smartboard and the lesson-note graph are untouched. Limits: non-polynomial antiderivatives are numerical only; key points scanned on −10 ≤ x ≤ 10.

## Stage 5 — Full 3D: planes, intersections and cross-sections (done)
New "3D tools" panel. Linear equations such as 2x + y − z = 4 are drawn as flat translucent planes. "Where two planes meet" draws the intersection line (r = p + t·d, d = n₁ × n₂) or reports parallel / identical planes. "Solve three planes" solves the 3×3 system (Cramer's rule), marks the meeting point, or explains no solution / infinitely many via rank. Surfaces can be sliced at any height with a slider; the slice is drawn as a yellow contour. One-click example of three planes meeting at (1, 2, 3). Existing points with drop lines, 3D lines, spheres and surfaces unchanged; phones keep lower surface detail. Significance: students see why a linear equation in x, y, z is flat and why a 3×3 system has one, none or infinitely many solutions. Limits: a plane without z (e.g. x − y = 0) must be typed as x − y + 0z = 0 to appear in 3D.

## Stage 6 — Matrix and linear algebra lab (done)
Preset transformations, determinant as area scaling, matrix products with entry-by-entry steps, eigenvalues/eigenvectors (2×2 with the characteristic equation; 3×3 numerical), inverse/transpose, solving A·x = b, and the transformed unit square with eigenvector directions drawn. Verified: eigenvalues 5 and 2 of [[4,1],[2,3]]; rotation reported as no real eigenvalues; singular systems rejected. Limits: 3×3 eigenvalues have no line-by-line working; the moving picture is only for 2×2.

## Stage 7 — Differential equations (done)
Slope fields for dy/dx = f(x, y) with Euler steps (red dashed) against the accurate RK4 curve (blue), exact solutions for dy/dx = ay + b with full working and a stability verdict for the equilibrium, step tables, and "Plot on graph" for the exact solution. Verified: dy/dx = y gives e^x; Euler for h = 0.5 gives 2.25 after two steps. Limits: the exact method covers ky + c only.

## Stage 8 — Real-world problems (done)
Six problems across calculus and matrices with answers computed by the Lab's own engines (so they cannot drift), 1% answer tolerance, "Show working" and "See the graph" buttons, and a running score. Limits: scores are not saved; teachers cannot yet add their own problems.

## Stage 9 — Real analysis (done)
New "Analysis" panel with five tabs. Sequences: terms plotted as dots with a convergence verdict (settles ≈ L / grows without bound / never settles). Series: partial sums Sₙ plotted and tabulated, with geometric exact sums a/(1−r), p-series recognition (Σ1/n² → π²/6), harmonic divergence, and the alternating error bound. ε–N band: pick ε, the panel names the smallest N whose terms all stay inside L ± ε, and the band can be drawn on the main graph. ε–δ and continuity: type f, a and ε — the engine finds δ numerically, writes the working in words, gives a continuity verdict, and offers three counter-examples (sign(x) jump, sin(1/x) oscillation, floor(x) steps). Taylor: coefficients by central differences (labelled ≈), the polynomial overlaid on the real curve, degree slider, and a note when the coefficients match the classic sin x / cos x / e^x series. Significance: university-style rigour becomes a picture — the teacher drags ε and N or δ appear, and students watch partial sums creep toward a limit and a Taylor polynomial hug sin x before bending away. Limits: numerical derivatives and limits are labelled ≈, not symbolic proofs; ε–δ is found by scanning, not algebra; verified in the test browser with zero runtime errors, but not yet on a real phone or tablet.

## Stage 11 — done
Complex (Argand, ×/÷ as turn+scale, roots of unity, domain colouring), Geometry (transformations, conics with foci/directrix), Probability (normal/binomial/Poisson sliders), Statistics (regression, r, R², summaries), Numerical (Newton–Raphson, bisection step by step). Pure engines with 14 known-answer tests; browser-checked on desktop.

## Stage 10 — Full ODE models and systems (done)
Presets (growth/decay, logistic, Newton's cooling, predator–prey, spring, pendulum) with sliders and real-world meaning, tap-on-field solution curves with history, equilibria with stability lines, phase plane with x(t)/y(t) over time, and Euler vs RK4 step tables with exact/error columns. Limits: equilibria only for equations without x; not yet checked on a real phone.

## Stage 12 — Saving, students, offline and final review (done, final stage)
Teachers save and name Math Lab scenes to the cloud and share them with chosen classes (new Share panel; tables math_lab_scenes + math_lab_scene_shares with row-level security, staged as an additive migration that applies when this draft is accepted). Students open shared scenes at /math-lab/scenes and /math-lab/scene/:id and can only use the controls the teacher allowed (equation editing, drawing tools, console). Math Lab registers an offline shell (public/mathlab-sw.js) so it opens without data after the first load — all maths already runs on-device. Accuracy review: a test suite checks every Equation Library entry parses and the engines match known textbook answers (118 Math Lab tests pass). Significance: a teacher builds a 3D plane-intersection scene once, sends it to a class, and every student explores it on their own phone, even without data — Math Lab moves from a demonstration tool to a learning tool across MathGPL. Limits: cloud save/share cannot be exercised in this draft until the migration is applied on accept; offline shell registers only in the published app; real phone/tablet check still outstanding. The optional shared-engine change (Lesson Notes/Smartboard/Games/Academia using the Math Lab engine) was not done — it needs your separate approval.

## Stage 13 — Single input box and interpreter (construction-engine roadmap)
One box now reads equations, systems (`2x = y + 3; x + y = 6`), matrices (`[1 2; 3 4]`), `dy/dx = …`, `4D`, and topic words (eigenvalues, binomial, Riemann…) and opens the right view. Every curve shows computed roots, y-intercept, turning points, axis of symmetry and a coordinate table. *Significance: students type the maths they meet without choosing a tool.* Next: Stage 14 (Explore / Step-by-Step / Show Solution).

## Stage 14 — Explore / Step-by-Step / Show Solution
- `src/lib/graphApp/steps.ts`: pure step writers. `linearCoeffs` extracts a·x+b·y=c from any linear equation (verified at a fresh point); `systemSteps` solves 2×2 systems by elimination with the real numbers in every line, and detects parallel (no solution) and coincident (infinitely many) lines; `quadraticSteps` expands vertex form, gives vertex/axis/discriminant/roots/y-intercept; `asVertexForm` recovers a, h, k from a plotted curve.
- `src/components/graphApp/ModesCard.tsx`: "Learn it" card on the 2D canvas with Explore (guiding question first, a/h/k sliders for quadratics that re-plot live), Step-by-Step (one micro-step per line, Next button), Show Solution (all steps + answer).
- Wired into `GraphAppPage.tsx` for 2D mode.
- Significance: Math Lab now teaches the why, not just the answer — picture, algebra and reasoning stay linked.
- Tests: 11 new (reference system (3,3), changed-numbers variant (7,3), parallel, coincident, vertex roots, no-real-roots, repeated root, vertex-form recovery, non-quadratic rejection). 139 graphApp tests pass; typecheck clean.
- Next: Stage 15 (concept entry — "Explore Concept").

## Stage 15 — Concept entry ("Explore Concept")
Typing a concept — eigenvalues, binomial distribution, Riemann sums, Fourier series, 4D geometry, Taylor series, normal distribution — opens a guided card that asks for the values it needs, then builds the demonstration from Math Lab's own engines (binomial plotted as computed points, Fourier as real sine partial sums, eigenvalues loading the typed matrix, 4D opening the hypercube). On-device registry, no AI guessing; unknown topics still get an honest message. Significance: a student who only knows the *name* of the idea from class can explore it without knowing which tool or formula to start from. Next: Stage 16 (solids and word-style geometry).

## Stage 16 — Dimensioned solids (done)
- Type `cube with side 5 cm`, `cuboid 3 by 4 by 5 cm`, `sphere radius 3 cm`, `cylinder radius 3 cm height 8 cm`, or `cone radius 3 cm height 4 cm`. Solids is also available beside 3D tools and examples appear in the 3D library.
- One validated specification drives rotatable geometry, dimension labels, local measurements and saved scenes. Supports mm, cm, m, mixed-unit conversion, reordered labels and diameter input. Missing, duplicate, unsupported or nonpositive dimensions produce errors rather than guessed models.
- Cube/cuboid: volume, total surface area, space/base-face diagonals and six-face nets. Sphere: volume, area and diameter. Cylinder: volume, closed surface area and axial-section diagonal. Cone: volume, total area and slant height; no misleading space-diagonal claims. Dimension edits rebuild the same model; working shows formula, substituted values and results.
- **Significance:** links three-dimensional objects, two-dimensional nets and formulas; students inspect hidden lengths and change dimensions without redrawing. Useful for packaging, material estimates, capacity and spatial reasoning.
- **Verification:** all 161 Math Lab tests passed; signed-in browser verified the 5 cm cube (125 cm³, 150 cm², diagonal ≈ 8.660254 cm), drag rotation, net, dimension edit to 6 cm (216 cm³), all five shapes, save/reload/reopen, phone-width model and scrolling to measurements. Build clean, no page errors. Real-device touch and published offline caching remain unverified; curved-solid nets and other solids are not included.
- Next: Stage 17 guided reference journeys.

## Stage 17 — Guided journeys
Six on-device journeys (lines, parabola, cube→cuboid, Riemann, eigen, binomial→normal) with computed checks, hints, Change the numbers, per-device progress. Not yet: starting a journey from a shared scene.

## Stage 18 — Verification and honesty (done)
- `verify.ts`: roots, turning points and intercepts are substituted back into the equation; implicit curves are sampled and each point checked; undefined regions and asymptotes are reported instead of drawn.
- Key-features card shows "Checked" or the failing claim, plus honest warnings.
- Tests: every reference journey re-checked on three unseen sets of numbers.
