## Technical details
- `src/lib/graphApp/journeys.ts` is a pure module. Each journey is a list of steps, and each step has three parts: `build(seed)` returns the action (plots, solid, matrix, concept or panel), `answer(seed)` is computed by the existing engines, and `check(input)` uses a tolerance. A seeded generator handles "Change the numbers".
- `JourneyPanel.tsx` holds the list, the step card, the answer box, the hint and Next/Back. It is wired into `GraphAppPage.tsx` through the existing action paths: interpret, solid and concept.
- Progress is stored on the device per account and journey. The journey id and step are carried in `LabSnapshot` so shared scenes can start a journey.
- No database changes and no AI.
- Vitest checks each journey's reference answers ((3,3); 125/150/5√3; the Riemann sum approaching the exact integral; the eigenvector direction staying the same). A second run with different numbers proves nothing is hard-coded.
- `docs/math-lab-progress.md` is updated.
