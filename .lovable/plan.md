# Open Face — inspectable hollow solids in the 3D Geometry workspace

Add a face-level **Open Face / Close Face / Reset** capability to the existing 3D Geometry
workspace. Nothing about the current engine changes: Wireframe/Solid, insertion, rotation,
scaling, duplication, deletion, lesson modes and lesson-note embedding all keep working as
they do today.

## Where this lands

The workspace already has exactly the structure the request describes:

- The object panel already offers **Wireframe | Solid** (kept untouched).
- Entering teaching (the "lesson" stage) already shows **Lesson Modes**, and the
  **Faces, Edges & Vertices** mode already lets the teacher choose Face / Edge / Vertex
  and click an element on the solid, with the picked element highlighted.

So Open Face is added as a **Face Actions** group inside that existing Faces, Edges &
Vertices tool panel — no new mode, no new dialog, no second 3D system.

## Behaviour

1. Teacher inserts a shape, sets it to **Solid**, enters **Teach → Faces**.
2. Clicks the front face — it is highlighted as it already is today.
3. **Open Face** removes only that face's surface. The other faces stay solid, all edges
   and vertices stay exactly where they were, and the interior becomes visible through
   the opening — a real empty 3D container, not a transparent object and not an overlay.
4. The teacher can rotate, zoom and move the camera through the opening to look inside;
   the inside is lit and the walls are visible from behind.
5. **Close Face** restores that face; **Reset** closes every open face at once.
6. When the selected face is already open, the button reads **Close Face**.
7. Any number of faces can be open at the same time (top, then front, then more) —
   the state is a list, so multi-face opening works from the start.

## Technical notes

- `Solid3D` gains `openFaces?: number[]` (topology face indices). It is added to the scene
  sanitiser so scenes saved in lesson notes round-trip; existing saved scenes have no such
  field and stay closed.
- Rendering in `Scene3DCanvas`'s `Solid3DMesh`:
  - **No open faces** → the current single-mesh path, byte-for-byte the behaviour today.
  - **One or more open faces** → the same solid is drawn as a *shell*: one mesh per real
    topological face, each built from the existing `topology.ts` face data, with the open
    faces simply not drawn. The wireframe `lineSegments` layer is unchanged, so the frame
    of the opening stays visible like the rim of a carton.
  - Faces render with `side: THREE.DoubleSide`, so walls are solid when seen from inside.
  - Curved solids: cylinder / cone / frustum use the open-ended geometry variant when a
    circular cap is opened, with the remaining cap drawn as a disc. Sphere and hemisphere
    have a single curved surface, so opening it exposes the whole interior.
- Interior viewing: the orbit controls' minimum distance is lowered and a camera-follow
  light is added inside the object group so the interior is not pitch black when the
  teacher moves the viewpoint into the opening.
- Wireframe mode ignores `openFaces` (there is no surface to open); the buttons are
  disabled with a short hint in that mode.
- Files touched: `src/lib/geometry3d/scene3d.ts` (field + sanitiser),
  `src/components/lessonnotes/geometry3d/Scene3DCanvas.tsx` (shell rendering, interior
  light, closer zoom), `src/components/lessonnotes/geometry3d/lessonmodes/FacesEdgesVerticesTools.tsx`
  (Face Actions controls), and `Workspace3DDialog.tsx` to pass the open/close/reset handler.
  No other 3D file is modified.

## Verification

Insert a cube → Solid → Teach → Faces → click the front face → Open Face: five faces stay
solid and the inside is visible; rotate and move the camera inside and back out; open the
top face as well; Close Face and Reset return the cube to a closed solid. Then save the
note, reopen it, and confirm the open faces persisted.
