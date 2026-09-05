# Real 3D Frames + Interior Windows

Two new building objects, built the same way: a solid 3D structure with a hollow
centre, plus a separate picture placed inside it. The structure is never a flat
picture, and the picture never replaces the structure.

## 1. Frames become real 3D objects

Today a frame is one flat image on the wall. It becomes:

- An outer frame built from four solid mitred bars with real thickness, a raised
  front face, bevelled inner and outer edges, and visible side surfaces.
- A recessed inner opening set back from the front face.
- A content panel sitting inside that recess, slightly behind the front bars, so
  moving left/right shows the frame's depth and the picture sitting inside it.
- Flat, straight geometry — no bending or stretching to the wall, only mounted
  flush against it.

Four frame styles taken from the supplied reference sheet, each defined by
material and profile values (bar depth, bevel, colours, metalness, roughness,
corner ornaments), not by an image:

1. Royal Gold — navy face with gold bevels and corner ornaments.
2. Brass & Walnut — dark wood bars with brass corner plates and a top plaque.
3. Sci-Fi Steel — brushed steel bars with inset blue light strips.
4. Vine Oak — warm oak bars with carved vine relief and leaf accents.

Windows get their own two styles derived from the existing door frame language
(same navy/steel trim, window proportions) so doors, windows and frames read as
one architectural world. The existing door design is not touched.

## 2. Frame content

After choosing the frame design, the teacher picks the picture that goes inside:

- Upload an image
- My Gallery
- MathGPL Assets (the existing sample library)

The picture is fitted inside the inner opening without distortion; an empty
frame shows a plain recessed backboard. Changing the picture never changes the
frame, and the existing link list (Courses, Assignments, Adventures, Games) stays
exactly as it is — a frame may still be clickable.

## 3. Windows

A new Window object, same workflow, purely architectural:

- 3D window surround with depth, sill, interior trim and side reveals, seated
  into the wall from the inside view.
- A glass/scene image inside the opening, chosen from Upload / My Gallery /
  MathGPL Assets, with a subtle glass sheen over it.
- No link, no navigation, not clickable. Multiple windows per room allowed.

## 4. Building Settings

The existing Building Settings page keeps every current section. The current
"Frames" section becomes **Frame & Window** with two actions:

- Add Frame → choose design → add picture → choose wall → position
- Add Window → choose design → add picture → choose wall → position

Positioning reuses the controls already there: wall (Left / Right / End),
horizontal position, height, size, rename, delete — plus a Lock toggle that
freezes a placed frame or window so it can't be nudged by accident. Start Point,
Terminal Wall, Ceiling, Doors, Lighting, Effects, Hallways & Rooms, Add Room,
locks, navigation and the Building Map are untouched.

## Technical notes

- DB: extend `building_frames` with `kind` ('frame' | 'window'), `content_url`,
  `content_source`, `height_ratio`, `locked`; grants and RLS mirror the existing
  policies. No table is dropped.
- New `src/lib/building/frameStyles.ts` holds the four frame profiles and the two
  window profiles as pure geometry/material data.
- Rewrite `FrameBoard.tsx` as `FrameObject.tsx`: mitred bar meshes + recessed
  backboard + content plane; add `WindowObject.tsx` for the window surround with
  reveal walls and glass.
- `frames.ts` gains window helpers and per-style aspect handling; `roomFrameMount`
  / `hallFrameMount` reused unchanged for placement.
- `FrameManager.tsx` gains the kind tabs, style picker, picture picker (upload to
  the existing game-assets bucket, gallery/assets browse) and the Lock toggle;
  windows hide the link section entirely.
- `ClassroomShell.tsx` and `HallwayScene.tsx` render both kinds; windows never
  receive click handlers.
- Verify by signing in, opening a room, placing a frame and a window, and
  screenshotting from angles to confirm visible depth.
