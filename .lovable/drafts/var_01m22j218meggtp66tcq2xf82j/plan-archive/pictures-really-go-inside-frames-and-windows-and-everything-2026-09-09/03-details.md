## Technical detail

### Picture visibility (root cause, confirmed)

- `building_frames` rows already carry `content_path` (an uploaded
  `<uid>/building-frames/<id>/…png` and a `builtin:` sample), and the uploader's
  own storage policy (`Teachers read own game files`) signs it. So upload and
  data write are correct; rendering is at fault.
- `WindowObject.tsx`: the view plane is at `z = -reveal * 0.85` (behind the wall
  plane), while `FrameStructure`'s recessed backboard sits at `z = depth * 0.22`
  in front of it — the picture is fully occluded. Move the view plane to just
  inside the opening (in front of the reveal, behind the glass sheen), keep the
  glass and glazing bar in front, and suppress the structure's backboard when a
  picture exists (new `hollow`/`showBack` prop on `FrameStructure`, default
  unchanged for doors/frames without content).
- `FrameObject.tsx`: content plane at `depth * 0.3` versus the backboard's front
  face at `depth * 0.27` — a ~3 mm gap that z-fights. Push the content plane
  clearly in front of the backboard and hide the backboard (and the "ADD A
  PICTURE" label) when `contentUrl` resolves.
- `useImageTexture` / `coverFit` stay as they are, but `coverFit` moves into an
  effect keyed on `tex` so the crop re-applies after a late-loading texture, and
  a failed load logs once instead of silently blanking.

### Size, shape and position

- Frames/windows: keep `width`, `height_ratio`, `offset_along`, `offset_y` and
  the `FRAME_SHAPES` presets. In `HallwayScene`/`ClassroomShell`, `onSelect`
  already fires; wire it in `AcademyEditorPage` so selecting an object opens the
  matching accordion section (Frames or Windows), expands that row and scrolls it
  into view.
- Smart Screen: `screenMount(kind)` is derived only from room type. Add optional
  per-room overrides on `building_room_screens` — `width`, `height_ratio`,
  `offset_x`, `offset_y` — as an additive staged migration under
  `.lovable/drafts/var_01m22j218meggtp66tcq2xf82j/migrations/`, all nullable so
  existing rooms keep today's automatic size. `screenMount` takes the row and
  falls back to the derived values; `SmartScreenControls` gains the same
  slider/preset set as a frame (size, Portrait/Square/Widescreen/Landscape,
  across the wall, height), teacher/manager only.

### Adding pictures from this page

- `FrameManager`: Upload becomes the primary full-width action; "MathGPL assets"
  becomes a small secondary link opening the existing `PicturePickerDialog`
  unchanged. Same pair on the Smart Screen for a still image is out of scope —
  the screen keeps video upload.
- Errors already surface via `run()`; add an explicit success toast so a picture
  that goes in is confirmed.

### Untouched

Hallway and room geometry, navigation, doors, locks, the Building Map, lighting,
effects, frame/window 3D profiles, the gallery system, and the video playback
pipeline.

### Note

The per-room screen size columns apply when this draft is accepted, so screen
resizing can only be exercised after that; frame and window fixes work
immediately.
