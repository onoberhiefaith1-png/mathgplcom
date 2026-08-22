# Restore lesson-note diagram layout on the Smartboard

## Confirmed diagnosis

- The affected lesson note stores its page drawing as one `geometryDiagram` scene with a 1,200 × 1,200 declared canvas, while its drawn objects extend vertically to about 2,278 units.
- The scene contains the quadrilateral around lesson-page y≈967–1,280 and two circles around y≈1,961–2,278. The Smartboard currently renders that entire tall scene as one SVG after all lesson text.
- `GeometryDiagram` calculates a roughly 1,248 × 2,326 viewBox, limits its normal display width to 520px, then the board additionally limits it to 60vh. That combination shrinks the actual figures into faint thumbnails.
- The saved object already records `afterLine: 14`, but `PresentationView` ignores it and appends every object beneath the complete text block. This loses the lesson-note ordering and explains the misplaced diagram.
- This is a presentation/layout defect; the diagram objects are reaching the Smartboard correctly and no database schema change is needed.

## Plan

1. **Preserve object anchors in each beat.** Interleave Notes-layer objects with lesson text using each object's saved `afterLine` value instead of placing all objects after the whole beat.
2. **Render page drawings by occupied regions.** For a notebook-wide page-layer scene, derive compact visual groups from the real geometry extents and large vertical gaps, so the quadrilateral and each distant circle render at their own lesson position rather than as one enormous mostly-empty SVG.
3. **Keep geometry intact.** Each group will retain complete constructions and dependencies (segments with their points, circles with centre/rim points, angles with their arms) so nothing is clipped, detached, or mathematically altered.
4. **Use readable board sizing.** Give 2D diagrams a stable responsive board width, preserve aspect ratio, remove the 60vh rule that causes tall-scene thumbnailing, and size from the occupied geometry rather than the notebook canvas.
5. **Strengthen projected ink without changing the note.** Add an explicit presentation rendering mode that uses board-readable stroke weight, point size, and label size/contrast while preserving authored colours and the original lesson-note renderer for editing.
6. **Maintain orderly flow.** Render diagrams as normal Notes-layer content—never absolute overlays and never floating-number items—with spacing that prevents overlap with equations or following prose.
7. **Verify the exact reported note.** Open the specified lesson note and its Smartboard in an authenticated browser session, confirm the quadrilateral and circles appear in source order at readable scale, check no text overlap at desktop and mobile widths, and capture the requested Smartboard screenshot as proof.

## Technical details

- Primary files: `src/lib/smartboard/presentation.ts`, `src/components/smartboard/PresentationView.tsx`, `src/components/lessonnotes/SolutionObjectView.tsx`, `src/components/lessonnotes/GeometryDiagram.tsx`, and `src/styles.css`.
- Add focused tests for line/object interleaving and page-scene grouping, including a scene whose objects extend beyond declared bounds.
- Do not modify the lesson question, diagram coordinates, or stored notebook data.
