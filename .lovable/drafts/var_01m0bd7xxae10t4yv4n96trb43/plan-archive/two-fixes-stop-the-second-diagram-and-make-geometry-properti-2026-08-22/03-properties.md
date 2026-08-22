# Part B — Geometry Properties becomes teacher-authored

The existing workspace already mounts the *same* diagram (no second engine), keeps ids stable,
and highlights by id. What changes is who writes the mathematics and how the panel behaves.

## One diagram only

The workspace already opens from the selected diagram, but the panel currently advertises
itself as a whole-solution map. It becomes strictly per-diagram: the properties live on that
diagram's own data (`scene.meta`), so a lesson with Diagram A, B, C can never cross-contaminate.
Switching diagrams switches the property set.

## Teacher Edit replaces the AI map

- "Generate map from solution" and the AI call behind it are removed from this feature.
  The old stored items are kept and shown as ordinary teacher properties, so nothing is lost.
- The panel header becomes **Teacher Edit** with a **+ Create property** action, unlimited
  properties, each editable, reorderable and deletable.

## Building a property

Select a part on the diagram → it is inserted as a chip named truthfully
(`LINE YP`, `LINE`, `ANGLE ABC`, `POINT P` — never an invented name). Then **Add function**
inserts real operators that actually land in the expression being built:
`= + − × ÷ √ x² x³ ( ) fraction | | ∠ ∥ ⟂ ° ~`, plus free typing for numbers and words.
The expression renders as proper mathematics using the app's existing math renderer, e.g.
`YP = √(S² − Z²)`, `sin θ = S/Y`, `AP × PC = BP × PD`.

Every insertion of a diagram part records that part's **internal id** alongside the display
token. Renaming a label later never breaks the link.

## Two-way behaviour

- Click a point/line/angle → the panel lists only properties whose stored referenced ids
  include that object. Changing selection replaces the list; nothing stacks.
- Click a property → every referenced object glows on the diagram at once, with a small
  legend mapping each token to its object; clicking one token narrows the highlight to it.
- Highlighting is an overlay only — the diagram itself is never modified.

## Smartboard

A **Diagram Properties** control is added to the existing Smartboard controls. The panel is
**closed by default**, opens as a right dock of about one third of the board, scrolls
independently, and closes without touching the diagram. Same panel for teacher and student;
students get view + click only, no create/edit/delete. Empty state: "Select a point, line,
angle or other geometry part to view its properties."

## Not changing

The diagram editor, selection/highlighting system, labels, lesson-note and Smartboard
rendering, and the whole existing 2D/3D geometry toolset stay as they are.
