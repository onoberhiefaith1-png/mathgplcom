# Classroom objects: TV, Frames, Windows, MathGPL Assets and "Add to Building"

An upgrade to the building system that already exists. No new building, frame, window, TV, asset library or guest-link system is created — only the missing capabilities are added.

## 1. Move and resize objects by hand (TV, Frame, Window)

Today a frame or window is positioned with sliders, and the TV is fixed to the front wall by a formula.

- Selecting an object in the room or hallway shows a selection outline and corner/edge handles.
- Dragging the body slides the object along the wall it belongs to, and up or down that wall. It can never leave that wall or drift into the room.
- Dragging a handle changes width and height freely; corner handles keep proportion, edge handles change one side. A proportion control switches between landscape and portrait.
- Movement follows the pointer immediately, with no fixed steps. The existing sliders stay as a precise alternative.
- Locked objects cannot be nudged (already supported for frames; extended to the TV).
- The TV becomes a movable, resizable object on its wall while keeping every existing video behaviour: upload, replace, remove, camera, and playback for students entering the room.

## 2. Everything is remembered

The TV gains stored wall, position, width, height and rotation, so it reopens exactly where it was left. Frames and windows already store these and keep doing so, plus their name, image and any linked content. Logging out and returning restores the whole environment: hallways, rooms, doors, windows, frames, TV, background, lighting and effects.

## 3. Frame pictures

A frame is just a container for a picture — never assumed to be an assignment, course or adventure. In frame settings, "Add image" offers two routes:

- Upload from device (already exists).
- MathGPL Assets — browse the existing shared library and pick an image.

Replacing the picture never creates a second frame.

## 4. Frame names

Every frame keeps a unique, creator-chosen name inside its building (Front Wall Frame, Welcome Frame, …). Names are used later to choose where content lands, so duplicates inside one building are refused with a clear message.

## 5. MathGPL Assets: an Add tile, for authorised people only

- A permanent "+ Add" tile shaped like an empty frame is always the first item in the MathGPL Assets gallery, and stays first as the library grows.
- Only the site owner, administrators and authorised Asset Managers see it. Everyone else can browse and use the library but cannot add, change or remove shared assets — enforced on the server, not just hidden in the interface.
- Clicking it opens the existing upload dialog. The uploaded image joins the shared library permanently and appears immediately in every frame picker, for every user.

## 6. "Add to Building" beside Guest Link

Guest Link is untouched everywhere it appears. A separate "Add to Building" action is added next to it on:

- the assignment / assessment card,
- the course card,
- the adventure,
- other existing places that already offer a Guest Link and are meant to open from a classroom.

It is not a public link. Choosing it shows the buildings the teacher can edit, then the named frames inside the chosen building, and saves a link: content → building → that frame. A frame holds one current shortcut, shown in its settings, and linking never creates a duplicate frame. Frames start life with no content link at all.

## 7. The frame as a student shortcut

A student in the classroom clicks the frame and lands directly on the assigned course, assignment, adventure or assessment page — no dashboard journey. The shortcut uses the student's own signed-in account, so class membership, ownership and progress rules apply exactly as they do today. An unauthorised student sees the same refusal the normal route gives. Deleting a frame or a link never deletes the original work.

## Technical notes

- Data: add `wall`, `offset_along`, `offset_y`, `width`, `height`, `rotation`, `locked` to `building_room_screens` (with defaults matching today's computed `screenMount`, so existing rooms look unchanged). Add a per-building unique index on frame name. Keep `building_frames` / `building_frame_links` as the single frame + shortcut store.
- Geometry: `screenMount()` in `src/lib/building/screen.ts` becomes "stored values, falling back to the current formula". Frames continue through `frames.ts` mounting geometry.
- Interaction: one shared drag/resize gizmo component in `src/components/academy/world/` used by `SmartScreen`, frame and window meshes; pointer moves are projected onto the owning wall plane, clamped to the wall, applied locally at once and saved on release (debounced).
- Pickers: extend `FrameManager`'s image step with a MathGPL Assets tab reading `gpl_assets` for the `building_editor` surface; reuse existing dialogs from `src/components/admin/assets/`. The Add tile is gated by the existing `canManageLibrary()` / `can_manage_gpl_assets` check and the existing insert policies.
- Add to Building: one shared `AddToBuildingDialog` (buildings the user may edit → frames of that building) writing through `addFrameLink`, mounted next to the existing `GuestLinkDialog` triggers in `CourseCard.tsx`, `ClassAssignmentsPage.tsx` and the adventure surface. `GuestLinkDialog` itself is not modified.
- Student open path: `FramePanel` keeps routing to the existing authenticated content routes; no public route is introduced.
- No Teacher Studio, no second asset library, no changes to hallway navigation, door/lock behaviour, Building Map styling or the smartboard.
