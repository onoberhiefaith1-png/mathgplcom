## Technical details

- New pure modules in `src/lib/graphApp/`: `interpret.ts` (classifies input → typed maths object), `features.ts` (roots, vertex, intercepts, coordinate table), `steps.ts` (step writer per family), `concepts.ts` (concept registry with required inputs), `solids.ts` (vertices/edges/faces/nets). They reuse the existing math, linalg, calculus, ode, complex, probability and stats engines; nothing is duplicated.
- One input component replaces panel selection as the front door; existing panels remain reachable for teachers.
- Implicit 2D drawing upgraded to marching squares with branch separation; 3D implicit keeps the current surface method.
- No database changes; all work runs on the device, so the offline Math Lab from Stage 12 keeps working.
- Vitest per reference journey with the document's answers (e.g. (3,3); cube 125 / 150 / 5√3; Riemann sums converge to the exact integral; eigenvectors unchanged in direction), plus a changed-numbers variant to prove nothing is hard-coded.
- Isolation rule kept in `AGENTS.md`; progress recorded in `docs/math-lab-progress.md`.
