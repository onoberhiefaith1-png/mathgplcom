## Graph — a new, separate app for teachers

Your documents ask for one thing first: a brand-new **Graph** application, opened from the teacher sidebar just below Academia, built completely separately from the graph that lives in Lesson Notes and the Smartboard. The existing graph is not touched at all.

The full vision (2D, 3D, matrices, calculus, ODEs, 4D–6D) is large, so this plan builds **Phase 1** properly and sets up the structure the later phases plug into, following the image you shared.

### Phase 1 (this build)

1. **Sidebar entry** "Graph" under Academia for teachers; route `/graph`, teacher-only, survives refresh, Back returns to the dashboard.
2. **Workspace layout** as in your picture: top bar (Academia brand, 2D / 3D / ND switch, equation box, Settings, Menu), left tool rail (Select, Point, Line, Plane, Equation, Shapes, Settings), centre graph, right Equation Library panel (search + tabs 2D / 3D / Parametric / ND / Matrices, each row with **Plot**).
3. **2D graph**: type `y = …` and it plots instantly; pan, wheel/pinch zoom, automatic scale, grid/axes/labels toggles, points, lines, a point sensor that shows coordinates, multiple coloured curves, Reset View.
4. **3D graph**: rotate/pan/zoom with mouse or one/two fingers; coloured X/Y/Z axes and floor grid; plot surfaces `z = f(x, y)`, implicit spheres `x² + y² + z² = r²`, planes `z = ax + by + c`, 3D points with drop lines and labels, parametric curves `x(t), y(t), z(t)`; View Controls card (Rotate/Pan/Zoom, Grid, Axes, Labels, Reset View).
5. **ND view**: tesseract (and 5-cube / 6-cube) shown by 3D projection, with a dimension selector and a rotation slider for the extra axis.
6. **Equation library** pre-filled with ready examples per tab (the ones in your image plus common school ones), all plotted by one click.
7. Works offline once loaded: all maths is calculated on the device, no AI, no credits.

### Later phases (not now, one per future session)

Matrices & transformations, eigenvectors, calculus (derivatives, Riemann sums), differential equations, guided "why this matters" lessons, saving graphs, and later linking into Lesson Notes / Smartboard / Games.
