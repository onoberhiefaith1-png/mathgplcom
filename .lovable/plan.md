# Venn Diagram Dynamic Teaching Highlight System

## Goal
Turn the current write-up highlighting into a true teaching mode:

- **Overview mode:** translucent set identity colours show which circle is Mathematics, Science, and C.
- **Focus mode:** all region interiors become neutral, set borders and labels keep their identity colours, and only the exact physical region(s) represented by the selected expression receive the consistent amber teaching highlight.

## What is true today
- The write-up already has a semantic expression-to-region mapper. It correctly distinguishes a three-set `A ∩ B` (`AB` + `ABC`) from `A ∩ B only` (`AB`), and expands unions across all included physical regions.
- Focus currently exists only as temporary input-focus state in the editor. Blurring the input clears it; it is not a saved teaching state and cannot be reliably controlled by AI Edit or retained on the Smartboard.
- The canvas draws temporary region shading and then draws the translucent set circles over it. This keeps competing set fills visible during focus and can make an “only” selection look like whole-circle colouring.
- Complements are supported by the diagram-generation helper, but they are not first-class selectable rows in the mathematical write-up.

## Build

### 1. First-class visual mode
Extend the Venn model with a backward-compatible teaching-focus field containing the active semantic expression, not arbitrary colours.

- Missing field on older diagrams means Overview mode.
- Selecting a write-up row activates Focus mode and persists the selected expression with the editable diagram.
- Clicking the selected row again, **Show all sets**, or **Clear highlight** returns to Overview mode.
- Closing the settings panel does not erase the selected teaching focus, so it remains usable in presentation/Smartboard view.
- Changing focus never overwrites set colours, region values, or any authored region styling; clearing focus restores the exact previous overview appearance.

### 2. Complete semantic expression engine
Expand the expression model from the current `only / union / intersection / universe` rows to support:

- A only, B only, C only
- AB only, AC only, BC only
- ABC
- inclusive pairwise and three-way intersections
- pairwise and three-way unions
- outside all sets
- A′, B′, C′
- complements of unions and intersections, including `(A ∪ B)′` and `(A ∩ B)′`
- set difference where already accepted by generated diagrams

Use one evaluator that converts every expression into a set of physical region keys. Panel clicks, AI Edit commands, generated diagram directives, tests, and rendering all use this evaluator.

For disjoint or otherwise impossible intersections, return an empty region set and show `∅` / “No common region” without inventing overlap geometry.

### 3. Exact physical-region renderer
Replace whole-circle/approximate focus colouring with deterministic SVG masks or paths for every physical region:

- A only, B only, C only
- AB only, AC only, BC only
- ABC
- outside all sets within the universal boundary

Focus rendering order:

1. neutral universal/diagram interior,
2. amber fill for the evaluated physical regions,
3. stronger amber region edge/emphasis,
4. original blue/orange/green set outlines and labels,
5. all values and mathematical annotations above the fills.

This guarantees that `A only` means inside A and outside every other set, while `A ∩ B` includes `AB` and `ABC` in a three-set diagram.

### 4. Overview identity colours and reusable tokens
Centralise the Venn visual roles instead of scattering colour literals:

- Set A identity: blue
- Set B identity: orange
- Set C identity: green
- low-opacity overview fills
- full-strength identity borders and labels
- amber focus fill and edge
- neutral focus background
- text/emphasis roles

New diagrams use the requested identity defaults. Existing saved custom colours remain unchanged. The roles are exposed through the project’s semantic styling system so future themes can alter presentation without changing mathematical logic.

### 5. Teaching controls and panel state
Make the full mathematical write-up row selectable, not only its input field.

- Mark the active expression with a clear selected state and `aria-pressed`/equivalent semantics.
- Keep the value input independently editable without losing focus state.
- Add **Show all sets** / **Clear highlight** at the write-up heading.
- Show an empty-set status for impossible selections.
- Keep labels and values readable above the highlight with contrast treatment and stable placement.
- Use a subtle 150–250 ms fill/emphasis transition and respect reduced-motion preferences.

### 6. Smartboard accessibility
Focus must remain understandable without colour alone:

- stronger selected-region edge,
- restrained glow/emphasis,
- active expression shown in the panel and available as an accessible label,
- values remain visible in both selected and neutral regions,
- identity-coloured set borders and labels remain visible throughout.

### 7. AI Edit and generated-diagram compatibility
Teach the existing diagram pipeline to set semantic focus rather than altering SVG or saved fill colours.

Examples:

- “Highlight Mathematics only” → focus `A only`
- “Show the intersection of Mathematics and Science” → focus inclusive `A ∩ B`
- “Show Mathematics and Science only” → focus `AB only` when that meaning is explicit
- “Show the union of Mathematics and Science” → focus `A ∪ B`
- “Highlight the three-way intersection” → focus `A ∩ B ∩ C`
- “Return to normal colours” → clear focus

Set names are resolved to A/B/C through the current labels. Ambiguous wording is not converted into arbitrary colour edits.

### 8. Verification
Add focused mathematical tests for:

- two-set only, intersection, union, complements, and outside;
- three-set only regions, pairwise-only regions, inclusive pairwise intersections, ABC, pairwise/triple unions, A′/B′/C′, complements of union/intersection, and differences;
- disjoint intersections returning an empty focus;
- renamed sets resolving to the correct region keys;
- focus persistence and clearing without changing saved values or colours;
- old models loading in Overview mode;
- exact canvas evidence that non-relevant regions are neutral while borders, labels, and values remain visible.

Finally, verify interactively in both the lesson-note editor and Smartboard-sized presentation: click through Mathematics only → Science only → Mathematics ∩ Science → Mathematics ∪ Science → Show all sets, confirming immediate region-correct transitions and no text obstruction.

## Preserved behaviour
- Existing set editing, layouts, manual placement, values, annotations, universal set, saved diagrams, and diagram generation remain intact.
- This does not redesign the editor or replace the Venn construction engine.
- Teaching focus is a separate semantic layer; it never mutates the teacher’s identity colours or mathematics.
