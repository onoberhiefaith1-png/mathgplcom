## Technical details

- `src/lib/graphApp/ode.ts` — add `rk4Steps` (table rows), error columns, `equilibria(f)` for autonomous equations (sign-change scan + bisection, stability from the sign of f′), `systemFn(fSrc, gSrc)`, `rk4System`, and `ODE_MODELS` presets (equations, default constants, meaning text).
- `src/components/graphApp/OdePanel.tsx` — Single/System mode switch, presets with sliders, tap-on-field to set the starting point (SVG click → coordinates), faint history curves, equilibrium lines, phase plane and x(t)/y(t) mini-chart. Panel stays self-contained; the page wiring is unchanged.
- `src/lib/graphApp/__tests__/ode.test.ts` — one test per rule: RK4 error for dy/dx = y at x = 1 under 1e-6 vs e; Euler error roughly halves when h halves; logistic equilibria 0 (unstable) and K (stable); cooling settles at room temperature; predator–prey with no predators grows prey exponentially; undamped spring returns near its start after one period 2π/ω.
- Verify: tests, typecheck, and a browser check of tap-to-draw, a preset, and the phase plane.
- Limits: equilibria only for equations without x; not yet tested on a real phone or tablet.
