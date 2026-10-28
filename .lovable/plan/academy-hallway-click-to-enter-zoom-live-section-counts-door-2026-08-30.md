# Academy Hallway: Click-to-Enter Zoom, Live Section Counts, Doorway Hover

## Goal

Polish the existing 3D Academy hallway (built inside the preserved building) so that:

1. Clicking a room doorway pauses any movement, smoothly zooms the camera into that door, then navigates into a real room page.
2. Every room doorway shows its section count (number of sections/categories) and the count — and the doorway order — stays in sync with the database as rooms, sections and products are added or moved, without a manual refresh.
3. Every doorway highlights on hover, in a tone that matches the hallway lighting, with no clipping or z-fighting with the door frame or its label text.
4. A full signed-in end-to-end flow verifies: create a room, add category/topic/subtopic, refresh, and confirm hallway doorway and editor state agree.

## Current state (verified)

- `src/components/academy/world/HallwayScene.tsx` renders the corridor: `SegmentCorridor` surfaces (floor/roof/walls), room `DoorMesh` doorways, branch arches, and a `CameraRig` with `browse` (doorway-to-doorway glide) and `walk` (free glide with arrow keys/WASD) modes. Doorway click calls `onEnterRoom` immediately.
- `AcademyWorldPage` (`/academy`) loads the academy tree once on mount and shows a `ShowroomPanel` overlay when a room is entered. Room doorway sublabel is `room.description || "Open room"` — no section count. The bottom "Enter <room>" button also enters the room.
- `AcademyRoom` has `categories` (each with `topics` → `subtopics`), so a room's section count is `categories.length` (the editor's "Add section" creates categories).
- **Known defect found during testing:** in walk mode the corridor surfaces are not visible — the view goes blank dark while the room doorways still render. This must be fixed first, otherwise zoom/hover polish has nothing to light.
- Routes today: `/academy`, `/academy/edit`, `/academy/course/$courseId`. No room page exists.

## What stays untouched

- The homepage rotating building and its geometry/artwork.
- The Academy hierarchy tables, editor CRUD, product engines and their routes (`/academy/course/...`, games, adventures, assessments).
- Walkway/building data model and `building_*` tables.

## Steps

### 1. Make the corridor visibly lit (prerequisite)

- Reproduce in both the world page and the editor preview; inspect whether the `SegmentCorridor` meshes render (temporary scene-graph probe: mesh count, bounding boxes, material colors) and whether this is a lighting/mood issue or a render bug.
- Fix accordingly: raise the visibility floor (brighter floor/wall materials and/or a hemisphere/rim light, lighter fog near value), keeping the tone consistent with the hallway lighting settings. Verify with screenshots in walk mode and browse mode.

### 2. Click-to-zoom transition into the room

- Add a third camera mode to `CameraRig`, e.g. `zoom`: pausing any walk movement (`movingRef`/`moving` off), then easing the camera from its current position toward the selected door's world position (same math the `DoorMesh` uses: `side * (HALL_WIDTH/2 - 0.2)`, facing the door), over roughly 0.8 s with frame-rate-independent damping.
- When the zoom completes, call `onEnterRoom(roomId)`, which now navigates to the room page (step 3).
- Block pointer drags and arrow keys during the zoom so the transition is not interrupted; if the user clicks a different door mid-zoom, retarget smoothly.
- Route the bottom "Enter <room>" button through the same zoom by lifting a `pendingEnter` signal into `HallwayScene` (it runs the zoom for the currently focused door, then enters).

### 3. Real room page: `/academy/room/$roomId`

- New route `src/routes/academy.room.$roomId.tsx` that loads the academy tree, finds the room, and renders the existing `ShowroomPanel` full-page with the same drill-down (category → topic → subtopic → products) as local state.
- The world page stops rendering the room overlay; entering a room (via doorway click or button) navigates to the route. `onLeaveRoom` / breadcrumb back navigates to `/academy`.
- This makes rooms deep-linkable and shareable instead of overlay-only state.

### 4. Live section counts on doorways

- `DoorMesh` sublabel shows the room's section count derived from the loaded tree: `"N sections"` (pluralised) when `categories.length > 0`, else `"Open room"`.
- Add a lightweight realtime subscription in `AcademyWorldPage` (`supabase.channel` with `postgres_changes` on `academy_rooms`, `academy_categories`, `academy_topics`, `academy_subtopics`, `academy_placements` filtered by the academy id) that debounce-refetches `loadAcademyTree`, so doorway counts, doorway order (room position changes) and the featured shelf update without a manual refresh. Clean up the channel on unmount.

### 5. Doorway hover highlight

- Give each `DoorMesh` a hovered state (pointer enter/leave). Animate the glow panel's `emissiveIntensity` up on hover (and back down on leave) via the existing `useFrame` lerp, scaled by `env.door.brightness` so the highlight matches the hallway lighting tone and the door's accent colour.
- Keep the highlight on the glow panel plane (scaling in-plane only, or a subtle whole-door group scale) so it never intersects the frame or the depth-tested-off label text — no clipping or z-fighting.
- Preserve the pointer cursor behaviour already present.

### 6. End-to-end verification (signed-in, authenticated)

- Playwright flow: open `/academy/edit`, create a room, add a category ("Add section"), a topic and a subtopic; save; hard-refresh the editor and confirm the room/section state persists.
- Open `/academy` and confirm the new room's doorway appears (in stored order) with the live section count, and that a second tab's editor change reaches the world without a refresh (realtime).
- Click the doorway: confirm movement pauses, the camera zooms into the door, and the app lands on `/academy/room/<id>` with the correct drill-down content.
- Confirm hover highlight appears on the doorway (screenshot) and that no console/page errors occur.
- Also verify the corridor surfaces are clearly visible in the walk mode screenshot (step 1).

## Technical details

- `HallwayScene.tsx`: extend `NavState` with a `zoom` mode carrying the target door world position and a progress value; `CameraRif`/`CameraRig` handles the ease; expose a callback or lifted `pendingEnter` index prop for the DOM Enter button. Door world position reuses the `DoorMesh` placement formula so the zoom lands exactly on the door.
- New route follows the existing `AcademyCoursePage` pattern (`ensureAcademy` + `loadAcademyTree`), with `head()` metadata (title/description/og) for the room.
- Realtime refetch is debounced (~300 ms) and guarded against out-of-order responses so an older tree never overwrites a newer one; the channel is scoped to the academy id.
- Section count uses `room.categories.length` (editor terminology: sections = categories). No schema change needed.

## Out of scope

- Changing the homepage building, the walkway/building editor, or product engines.
- Multiple hallway templates and advanced environment controls (Phase 2).