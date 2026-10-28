## Technical details

- New pure module `src/lib/graphApp/steps.ts`: step writers per family. `systemSteps(a1,b1,c1,a2,b2,c2)` returns the micro-step lines, the solution point, or a parallel/coincident verdict computed from the coefficients. `quadraticSteps(a,h,k)` returns expansion, vertex, axis and root steps. Pure functions, no DOM.
- `src/lib/graphApp/interpret.ts` gains a `solve` interpretation: a system of two linear equations in x and y is detected and routed to the new Modes card instead of only plotting.
- New `src/components/graphApp/ModesCard.tsx`: the Explore / Step-by-Step / Show Solution switcher, shown beneath the graph whenever the interpreter recognises a supported family. Explore mode renders the guiding question and enables point-dragging on the existing canvas; Step-by-Step reveals lines one at a time; Show Solution renders all steps plus the answer.
- Quadratic sliders (a, h, k) live in the Modes card and re-run the engine live, so steps and graph always match the sliders.
- Verification: every step writer is tested against known answers — (3, 3) for the reference system, parallel and coincident cases, vertex-form expansions — plus changed-numbers variants to prove nothing is hard-coded. Vitest, on-device, no AI.
- No database changes; Smartboard, Lesson Notes and Courses untouched; offline Math Lab keeps working.
- Progress recorded in `docs/math-lab-progress.md`.
