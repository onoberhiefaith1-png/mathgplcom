# Make diagram elements clickable again (one item at a time)

Goal: clicking a line, a text/number label, a point or an angle inside a note diagram immediately shows that item's settings on the right (add distance, colour, size, drag, etc.), and clicking another item replaces the first — exactly as it used to behave.

## What is confirmed

- The per-element engine still exists and is intact: a plain click replaces the selection with the item under the pointer, shift-click builds a multi-item selection, and label/point/measure drag is primed on the same click.
- The settings surface is the shared right-hand Properties Panel. It only auto-opens the **first** time a given asset id is selected; after the teacher folds it once, later selections never reopen it. A diagram registers under one id for the whole diagram, so selecting different elements inside it never re-opens the panel.
- The live (clickable) canvas only exists while the diagram block is selected in the note; otherwise a static picture is shown.

The exact trigger the teacher hit is not yet confirmed, so step 1 is a reproduction pass before any behaviour change.

## Plan

1. Reproduce in the running note: open the note diagram, click a line, a number and an angle, and record whether (a) the live canvas is mounted, (b) selection state changes, (c) the panel is registered but folded. Fix what the reproduction shows, not what it might be.
2. Panel access: when the selected element inside a diagram changes, re-open the panel for that new selection instead of staying folded, while keeping an explicit Close as a deliberate action (folding stays respected until the next new element is clicked).
3. First-click reliability: clicking a diagram that is not yet the active block should both activate it and select the element under the pointer, so no click is ever swallowed by the activation step.
4. Selection replacement: confirm a plain click always drops the previous item (one item at a time) and shift-click still accumulates for angle-from-two-lines and equal marks.
5. Per-kind settings: verify each selection kind opens its correct section — line -> add distance / text on line / colour / thickness, text or number -> size / colour / drag, angle -> value / arc / colour, enclosed region -> fill and opacity.
6. Verify by driving the note in a headless browser: click each element type in turn and confirm the panel title and controls change accordingly.

## Technical notes

- Files in scope: `src/components/lessonnotes/PropertiesPanel.tsx` (re-open rule), `src/hooks/useAssetSelection.tsx` (selection token so a new element counts as a new selection), `src/components/lessonnotes/extensions/GeometryDiagram.tsx` (first-click activation + selection token wiring), `src/components/lessonnotes/geometry-editor/GeometryCanvas.tsx` and `SelectionInspector.tsx` (only if the reproduction shows hit-testing or per-kind sections are at fault).
- No scene/data-model changes, no migrations: this is selection and panel behaviour only.
