## Goals
Make the Geometry Editor reliable, discoverable, and well-connected to the lesson note. Five tracks:

### 1. Fix the "instant wipe" bug (root cause)
`GeometryEditorPanel.tsx` mounts `PanelBody` with `key={\`gep-${Date.now()}\`}`. Because the panel lives inside `DocumentEditor`, every keystroke/save re-renders the parent → new key → PanelBody unmounts and remounts → scene + history reset to the original snapshot.

That's exactly what the teacher sees: place two points or a line, then the next commit propagates to the document, the document re-renders, and the panel snaps back to the original diagram.

Fix:
- Use a stable key derived from session identity (e.g. an id minted when the open event fires), not `Date.now()` on every render.
- Move the `<GeometryEditorPanel />` mount to a stable spot (top of `DocumentEditor`'s tree, outside any per-doc memoization) so its own state survives doc updates.
- Keep `onApply` updating the TipTap node, but stop re-seeding the panel's internal scene from `session.scene` after open; the panel is the source of truth until closed.

### 2. Explicit Save / Apply workflow
Today every action immediately writes back to the document. Teacher asked for a Save button so drafts stay local until confirmed.

- Editor keeps a local working scene + dirty flag.
- Footer gets three buttons: **Save** (writes back via `onApply`, clears dirty), **Revert** (restore last saved), **Close** (warns if dirty).
- Auto-save toggle off by default. AI Edit, Undo/Redo, tool actions only mutate the local scene.

### 3. Make every tool actually finish its action
Audit each tool in `GeometryCanvas.tsx` so a teacher can see the result without further interaction:

- **Point**: confirm two clicks produce two persistent points (fixed by #1).
- **Line**: after the bug fix, verify chain mode still works; add Esc to stop the chain.
- **Polygon**: needs an explicit "close" affordance — show a Close button in the hint bar when 3+ vertices pending, in addition to Enter key.
- **Circle (3-click hack)**: implement properly — points 1 and 3 lie on the circle, point 2 specifies the direction the arc/circle should pass through. Add `addCircleThrough3` to `sceneOps.ts` (circumcircle via perpendicular bisectors) and wire it into the `circle` tool's third click. Falls back to current drag-radius when only one click is made.
- **Arc**: same 3-point engine, but renders the arc segment between points 1 and 3 passing through point 2.
- **Angle**: confirm 3-click sequence commits (already correct after fix #1).
- **Equal / Parallel / Perpendicular**: ensure the second click on the same segment doesn't silently dedupe; show pending count in the hint bar.
- **Midpoint / Right angle / Erase / Label / Measure**: smoke-test each after the remount fix.

### 4. Foldable, named toolbar
Replace the icon-only strip with an expandable rail.

- Add a collapse/expand chevron at the top of `GeometryToolbar.tsx`.
- Collapsed (default, current width): icons only — matches today's look.
- Expanded: icon + label + one-line hint, grouped by category (Draw / Shape / Mark / Measure / Edit) using accordion sections.
- Persist expanded/collapsed in `localStorage` so the teacher's choice sticks.

### 5. Link the editor to lesson-note sections
Two flows:

**a. Quick insert from editor → current section**
- In editor footer add **Insert into note**. If the editor was opened from an existing diagram, this is just Save. If opened standalone (Diagram menu → New), this inserts a new `geometryDiagram` node at the current cursor's section (existing `sectionInsertPosition` logic).

**b. "Add to section" picker**
- New footer button **Add to section…** opens a popover listing every section/subsection heading in the current document (read from the TipTap doc via `notebookContext` + section walker already used by `handleSectionAi`).
- Selecting a section inserts the diagram immediately after that section's last node (reuse the diagram-preservation positioning logic).
- Works whether the editor was opened from an existing diagram (clone semantics: a copy goes to the chosen section, original stays) or from scratch.

To get the section list inside the panel, expose a small context/provider from `DocumentEditor` (`GeometrySectionsProvider`) that publishes `{ sections: {id, title, insertPos}[]; insertAt(id, scene) }`. `GeometryEditorPanel` consumes it; if not present (panel opened from a non-editor surface), the picker hides.

## Files touched
- `src/components/lessonnotes/geometry-editor/GeometryEditorPanel.tsx` — stable key, Save/Revert/Close footer, section picker UI.
- `src/components/lessonnotes/geometry-editor/useGeometryEditor.ts` — dirty flag, decouple `onApply` from every commit; expose `save()`.
- `src/components/lessonnotes/geometry-editor/GeometryToolbar.tsx` — collapsible rail with labels and groups.
- `src/components/lessonnotes/geometry-editor/GeometryCanvas.tsx` — 3-click circle/arc, polygon close button, Esc handling.
- `src/lib/geometry/editor/sceneOps.ts` — `addCircleThrough3`, `addArcThrough3Points` (circumcircle math).
- `src/lib/geometry/editor/tools.ts` — group metadata for the expanded toolbar.
- `src/components/lessonnotes/DocumentEditor.tsx` — mount `GeometryEditorPanel` at a stable location; provide `GeometrySectionsProvider`; expose `insertDiagramIntoSection(id, scene)`.

## Verification
After build, drive the preview with Playwright:
1. Open a diagram → place 3 points → confirm they persist.
2. Draw a line, then a polygon (close via button) — confirm both stay.
3. Three-click circle: pick A, direction point M, B → circle through A,M,B appears.
4. Expand toolbar, confirm labels show, collapse, reload, confirm preference sticks.
5. Open editor from Diagram menu → draw → Add to section → pick "Example 1" → verify diagram lands directly under Example 1 heading without touching other diagrams.
