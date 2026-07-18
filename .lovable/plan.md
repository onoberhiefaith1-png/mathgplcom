## Plan

1. **Remove the framed diagram behavior**
   - Stop treating geometry as a bounded block/node on the page.
   - Keep the existing object model and tools that already work: Point, Line, Circle, Arc, selection/highlighting, properties panel, angles, distances, and intersections.

2. **Create one notebook-wide geometry layer**
   - Add a transparent SVG drawing layer over the full lesson-note paper, from top to bottom.
   - When Diagram mode is on, the note text becomes the background: drawing clicks go to geometry tools, not text editing.
   - When Diagram mode is off, normal text editing works again.
   - The drawing layer will use the full notebook/page coordinates, so diagrams can overlap text and span multiple sections.

3. **Make new sections go underneath existing diagrams**
   - Keep the geometry overlay visually above the note content.
   - Section insertion remains normal document flow below/around existing content, while existing drawings stay over the notebook instead of being pushed or clipped by a section block.

4. **Fix Curve tool persistence**
   - Store curves as a continuous multi-point spline, not as separate straight segments between points.
   - The green live preview and the saved curve will use the same Catmull-Rom/smooth path renderer.
   - Selecting after drawing should show one smooth curve body, with its anchor points still available for editing.

5. **Preserve existing geometry features**
   - Keep point labels, line dissection, segment-specific highlighting, angle/distance labels, right-hand settings, auto-intersections, circle/arc behavior, and object deletion.
   - Existing older geometry diagram blocks will be migrated/rendered into the new notebook-wide layer where possible, rather than losing teacher work.

## Technical notes

- Current code still embeds geometry inside a TipTap `geometryDiagram` node, so the node itself is the visible boundary shown in your photo.
- I will move active drawing into the notebook paper layer in `DocumentEditor`, while reusing `GeometryCanvas`, `GeometryDiagram`, `useGeometryEditor`, and scene operations.
- I will update curve rendering/hit-testing so multi-point curves remain smooth after commit instead of falling back to point-to-point straight lines.