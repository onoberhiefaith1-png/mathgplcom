## 4. Colour-coded highlighting — the lit part wears its own colour

Right now every highlighted part is drawn in one shared review accent (red), whatever colour the teacher gave it. So EF, authored black, lights up red even though its property text reads black, and FD, authored blue, also lights up red. That breaks the whole point of colour coding.

What changes:

- When a part is lit — by clicking it, or by clicking a property that refers to it — it lights up in **its own authored colour**. EF black stays black, FD blue stays blue.
- The glow behind it uses the same colour, and the same visual weight as the authoring/test view, so a lit side reads as strongly on the Smartboard as it does while authoring.
- A part with no authored colour keeps the neutral review accent, so nothing becomes invisible.
- Identical behaviour for angles, arcs, regions and labels: a lit angle wears the colour of the angle it belongs to, and a label inherits its owner object's colour.
- Result: property text and diagram always agree, so students can read "EF = FD" and see instantly which black line and which blue line the statement is talking about.

## Technical notes

- `src/lib/lessonnotes/lessonOutline.ts`: extend the object record with `sectionKey` (segment index + kind + ordinal), `sectionOrdinal` (position of the diagram within its segment), and keep `inSolution`; populate in `renderSegmentBody`/`pushObject`.
- `src/lib/smartboard/presentation.ts`: order beat objects and `noteObjects` by `(sectionKey, sectionOrdinal, afterLine)` rather than array arrival order; keep `notesOnlyRows` attach-to-preceding-prose behaviour but drive the "diagram is the only note" case off the highlight state of the preceding row explicitly.
- `src/components/lessonnotes/DocumentEditor.tsx`: ensure `syncPageGeometryNode` writes/keeps a unique `diagramId` per carrier and does not reuse ids across sections.
- `src/components/smartboard/PresentationView.tsx`: thread `zoom` into the `SolutionObjectView` call sites, replacing the hard-coded font size with a zoom-derived scale; pass through `SolutionObjectView` → `ReviewableBoardDiagram`/`GeometryDiagram` as a new optional `scale` prop applied as a proportional width/transform multiplier.
- `src/components/smartboard/ReviewableBoardDiagram.tsx`: it already computes `reviewable`; surface that as the icon button and call a new `reviewProperties.openFor(diagram)` action.
- `src/lib/smartboard/reviewProperties.tsx`: add `openFor(diagram)` (opens with a specific diagram, not `candidates[0]`) plus a `fullscreen` flag.
- Reuse the full-screen layout from `SmartboardPropertyTest.tsx` as a shared student-facing relationship view rendered from `PresentationView` when `fullscreen` is set, feeding `ReviewPropertiesPanel` from the store state instead of local state.
- Colour coding, in `src/components/lessonnotes/GeometryDiagram.tsx`: `colourOf` currently returns `ACCENT_REVIEW` for any id in `highlight`, ahead of `objectColors[id]` — invert that precedence so an authored colour wins and `ACCENT_REVIEW` is only the fallback; the halo pass (`renderObject(..., ACCENT_REVIEW, ..., inkWeight * 4.5)`) takes the same per-object colour, and the lit stroke gets a modest weight bump so highlighting reads at authoring strength. Label objects resolve through their `ownerId`, which already happens.
- No schema changes: the new placement fields live in the existing object JSON on blocks/subsections and are backfilled on compile, so old notes keep working.
