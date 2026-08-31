# Door Asset Integration (3D Building)

Use the five uploaded transparent door images as real door assets in the existing hallway. Navigation, map, camera, walkway logic and the course pages stay exactly as they are.

## The actual problem today

In `src/components/academy/world/HallwayScene.tsx`, `DoorMesh` renders two coloured planes inside `<group rotation-y={-side * 0.55}>`. That fixed 0.55 rad tilt is why doors look slanted and detached, and the door face is a flat colour rather than a door image.

## What changes

### 1. Door images become reusable assets
- Upload the five images to the CDN as asset pointers (`src/assets/doors/*.png.asset.json`) — no binaries in the repo.
- New `src/lib/building/doors.ts` with a `DOOR_STYLES` list: `key`, `label`, `url`, plus aspect ratio and opaque-panel width so the frame can be sized from the artwork. Styles: Navy Vision Panel, Charcoal Full Glass, Charcoal Vision Panel, Oak Vision Panel, Steel Wired Glass, Glass Entrance.

### 2. Doors align to the wall
- Remove the tilt. The door group sits flush on the wall plane and is rotated to the wall's own orientation (`rotation-y = side * π/2`), so its face is parallel to the wall and looks into the corridor. A door can only ever appear angled if the wall itself is angled.
- The door sits inside a shallow recess: reveal jambs + lintel + threshold pieces so the read is WALL → FRAME → DOOR, one architectural unit.

### 3. Clean transparent rendering
- Door image applied as a `map` + `alphaMap` with `transparent`, `alphaTest`, `depthWrite` on, `SRGBColorSpace`, no background quad behind it — the wall shows through the cutout.
- Aspect ratio preserved: plane height fixed to the doorway height, width derived from the image ratio.
- `castShadow` on the door/frame so it drops a subtle shadow on wall and floor; lighting tone comes from the existing `env.door.brightness` and hall lights (no new light rigs).
- Textures loaded through a small cached loader (same pattern as surfaces), one instance per style, reused by every door.

### 4. Selectable door design
- Extend `DoorDesign` with `style: string` (default the first built-in). `mergeEnvironment` fills it for old records, so existing buildings keep working.
- Building-level default: a door-style gallery in `BuildingSettingsPanel` next to the existing colour/upload/brightness controls.
- Per-door override: a style picker per door row in `WalkwayManager`, saved into `building_doors.design` (already a JSON column — no migration needed). Custom uploaded door images continue to work and take priority over a built-in style.
- Door name, walkway, position and content assignment stay as they are today.

### 5. Interaction unchanged
- Hover still lights the door frame; clicking still runs `startDoorZoom` then the existing `onOpenDoor` / `onEnterRoom` handlers into the current course/room pages. No new pages, no routing changes.
- Labels stay legible: name on the lintel above the door, sublabel on the frame, not painted across the artwork.

## Verification
- Typecheck plus the existing building/navigation tests.
- Playwright screenshots at `/academy`: doors flush and parallel to the wall from head-on and at an angle, transparent surround, frame/recess visible, no console errors.
- Change the building default style and one per-door style, reload, confirm both persist.
- Click a content door and confirm it opens the existing course page.

## Out of scope
No changes to hallway navigation, minimap, camera movement, walkway logic, or course page design.
