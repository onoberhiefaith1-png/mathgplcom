## Goal

Two focused tweaks:

1. **Properties Panel shrinks and pushes the lesson-note content instead of overlapping it.** Fixed width of `10vw` (min 220 px so controls stay usable on small screens), and the document layout reserves that space when the panel is expanded.
2. **Point Label editor gains a Size control** so the teacher can grow/shrink the letter (A, B, C…) drawn next to a point. Same control will be added to the Point panel too, since either lands on the same label glyph.

Nothing else in the geometry editor changes.

---

## 1. Right panel: 10 vw, pushes content left

File: `src/components/lessonnotes/PropertiesPanel.tsx`

- Change the expanded `<aside>` width from `w-[min(360px,calc(100vw-48px))]` to a fixed `width: 10vw` with `minWidth: 220px, maxWidth: 360px` (10 vw of a typical laptop = ~140 px which is too narrow for the color picker + slider; the min keeps it usable, and it never grows past the old size).
- Also drop the width of the collapsed handle to stay proportional (keep `w-8` — it's already tiny).
- Signal the layout via a CSS variable + a body class so the document can react:
  - When expanded: `document.documentElement.style.setProperty('--properties-panel-width', <computed>px)` and add `data-properties-panel="open"` on `<body>`.
  - When collapsed / unmounted: clear the var and set `data-properties-panel="closed"`.
- Clean up on unmount so leaving the lesson-note page never leaves the padding behind.

File: `src/components/lessonnotes/DocumentEditor.tsx`

- Wrap the existing scroll/paper container (the sibling of `<PropertiesPanel />` on line ~1579) so it gets `paddingRight: var(--properties-panel-width, 0px)` and a `transition: padding-right 160ms ease`.
- Because the panel is portalled to `document.body`, styling the DocumentEditor root is enough — no layout re-shuffling needed elsewhere.

Result: the panel is a slim rail on the right; the notebook column stays fully visible and just narrows by the panel's width. Collapsing the panel returns the notebook to full width.

## 2. Point Label size control

Data model — `src/lib/geometry/scene.ts`

- Add `labelFontSize?: number` to `GeoPoint` (default 14, min 9, max 28). Sanitizer already passes through unknown fields; add a clamp in `sanitizeScene` alongside existing point fields so bad values can't break rendering.

Renderer — `src/components/lessonnotes/GeometryDiagram.tsx`

- At the point-label `<text>` (currently `fontSize={14}` on line 121), replace with `fontSize={p.labelFontSize ?? 14}`. Static and live renderers both share this path, so one change covers both.

Inspector — `src/components/lessonnotes/geometry-editor/SelectionInspector.tsx`

- In `PointLabelPanel`, add a **Size** row directly under Rename: a slider (9–28, step 1) plus the numeric value, wired to `onPatch({ labelFontSize: n })`.
- Mirror the same **Size** row inside `PointPanel` so clicking the dot exposes the same control (the teacher wants "after rename, add size" — putting it in both panels avoids a hunt).

No other components need to change; the AutoFitLabel logic used by charts is unrelated to geometry labels.

---

## Technical notes

- `10vw` on the current 847×473 preview = 84.7 px, which is too tight — the `minWidth: 220px` guard keeps color pickers/sliders usable while still visibly slimmer than the old 360 px panel.
- Using a CSS variable + `padding-right` (instead of restructuring layout to a flex row) is the least invasive way to make a portalled `fixed` panel behave like a docked column, and it plays nicely with the existing collapse/expand animation.
- Label font size is stored per-point (not per-scene) so different labels can have different sizes if a teacher wants one prominent vertex.
