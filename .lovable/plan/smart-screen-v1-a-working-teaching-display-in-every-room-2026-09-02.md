# Smart Screen v1 — a working teaching display in every room

Every room (Classroom, Teaching Hall, Auditorium) automatically gets one Smart Screen mounted on its front wall. No "Add Board" option exists — the screen is part of the room shell itself. Its content is either a teacher-uploaded video or the teacher's live camera, and students watch it from inside the 3D room.

## What gets built

**1. The screen object (automatic, per room)**
- A modern wall-mounted display on the front (teaching) wall of every room: clean rectangle, soft rounded corners, real depth, slim dark bezel, subtle glow — not a chalkboard, whiteboard or TV.
- Sized to each room type's proportions (bigger in Teaching Hall and Auditorium) and always anchored to the wall: it never floats or follows the camera, and grows/shrinks naturally as you walk toward or away from it.
- Idle state shows a quiet branded panel, so a room with no content never reads as broken.

**2. Content per room**
- Each room stores its own screen content. Uploading in GSS1 never changes GSS2, the Teaching Hall or the Auditorium.
- Videos are uploaded as files into private room storage and streamed back through short-lived signed links.

**3. Teacher / editor controls**
- Selecting the screen while inside a room, as someone allowed to edit that building, opens a small side panel with: Upload video, Replace video, Remove video, Turn on camera / Turn off camera.
- Upload shows progress and switches the screen to the new video when done.
- Everyone else never sees these controls.

**4. Student view**
- Entering a room with a video: it starts playing on the screen.
- Clicking the screen (or moving up to it) reveals clean controls that fade away again: play/pause, rewind, forward, scrubber with time, volume/mute.
- Students stay in the 3D room the whole time — no separate video page, no full-page takeover.
- Students cannot upload, replace or remove anything.

**5. Live camera → students**
- "Turn on camera" captures the teacher's webcam and shows it on that room's screen for the teacher, and broadcasts it live to every student currently standing in the same room.
- Students in the room switch to the live feed automatically while it is on, and fall back to the uploaded video when the teacher turns it off or leaves.
- v1 shows the raw camera image inside the screen: no background removal, no teacher-standing-in-the-room effect. The component is structured so that upgrade can be added later without rebuilding it.

## Out of scope (unchanged)

Room shells, walls, floors, ceilings, stairs, doors, hallways, Building Map, lighting style, navigation controls, galleries. No chairs, tables, windows or decorations.

## Technical notes

- New table `building_room_screens` (one row per classroom): `classroom_id` unique, `video_path`, `video_mime`, `duration`, `camera_active`, `camera_host_id`, timestamps. Table + GRANTs + RLS in one migration: read allowed to anyone who can see the building, writes only to the building owner / permitted editors, matching the policy shape already used by `building_classrooms`. Rows are created lazily on first content change, so existing rooms need no backfill.
- Video files live in the existing private `game-assets` bucket under `room-screens/<classroom_id>/…`, played through cached signed URLs (same helper pattern as building textures). Storage policies restrict writes to building editors, reads to authenticated users.
- New `src/components/academy/world/SmartScreen.tsx`: geometry (bezel box + rounded panel plane) plus a `THREE.VideoTexture` fed by a single hidden `<video>` element (or the camera `MediaStream`), with `colorSpace = SRGBColorSpace`. Screen dimensions/placement come from `src/lib/building/classroom.ts` as a `screenMount(kind)` helper so geometry and controls can never disagree.
- `ClassroomShell.tsx` renders `<SmartScreen>` unconditionally for all three kinds. `HallwayScene.tsx` passes the active room's screen state plus an `canEdit` flag it already receives from `BuildingData`.
- Controls are DOM overlays (existing HUD pattern), not in-canvas UI: a student control bar that auto-hides, and an editor panel. Raycast click on the screen mesh toggles them.
- Live camera uses Supabase Realtime: a per-room channel `room-screen-<classroom_id>` carries presence plus WebRTC offer/answer/ICE signalling; the teacher is the single publisher and each student in the room gets a peer connection. Only editors may publish; the client refuses to publish without edit rights and viewers only accept a stream from the row's `camera_host_id`.
- Playback and streaming teardown on room exit so nothing keeps running in the corridor; video element is reused (never remounted) so navigation never restarts playback.
- Verification: typecheck, existing classroom/navigation tests, plus an authenticated browser pass that enters a room, uploads a short clip as the owner, and confirms it plays on the wall panel.
