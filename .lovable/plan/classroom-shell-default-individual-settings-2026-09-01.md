# Classroom Shell + Default / Individual Settings

Stage 1 of the virtual classroom: build the classroom **shell** and the **settings inheritance architecture**. No Smartboard, table, chairs, frames, video, camera, teacher or student content.

## 1. Classrooms hang off doors

Structure: `Hallway → Door → Classroom`.

A classroom is a spatial structure of its own, attached to an existing door. Adding a classroom never creates a new door — it uses the door you pick.

New step-by-step flow in the editor's Add section:

```text
Add Classroom
   ↓  Step 1  Choose type:  Classroom | Teaching Hall | Auditorium
   ↓  Step 2  Choose an existing door (grouped by hallway, doors that already
              have a classroom are shown as taken)
   ↓  Step 3  Classroom name (required, e.g. "JSS1 Mathematics")
   ↓          Create
```

One step visible at a time, with Back. After creation the classroom is listed under its door in the structure tree, is selectable, and is renameable/deletable there.

## 2. Three architecturally different types

Same corridor wall height, genuinely different footprints — not one room scaled:

- **Classroom** — compact, roughly square footprint, flat floor.
- **Teaching Hall** — same width as Classroom, about 3x the length, flat floor.
- **Auditorium** — wide footprint with a stepped floor that descends in tiers toward the front teaching wall, which sits at the lowest point; ceiling stays level so the volume opens up toward the front.

## 3. Shell only

Each classroom renders: left wall, right wall, front wall, back wall, floor, ceiling, and the opening back to the door it belongs to (the way out). Auditorium floor geometry is built as stepped tiers plus tier risers. Nothing else is placed inside.

The classroom sits physically beyond its door: walking through the door takes you into the room, and the room has a clearly marked way back to the hallway. The room name is shown on the front wall using the existing architectural nameplate style (wall-mounted, never floating).

## 4. Default settings vs individual settings

Today the whole building shares one appearance record and there is no way to style a single hallway. This introduces two explicit levels:

**Default Settings** — one record per building, using the existing Redime default assets already in the gallery (no new visual style invented). Controls Left Wall, Right Wall, Floor, Ceiling, End Wall, Start Point, Door, Lighting, Effects. Changing a default instantly changes every hallway and classroom still on the default.

**Individual Settings** — pick one hallway or one classroom, change its walls / floor / ceiling. Only that element changes; everything else keeps following the default. A **Reset to Default** action per surface and per element clears the override so it inherits the current default again.

```text
Default Settings
      ↓ inherited by
Hallways + Classrooms
      ↓ user customises one element
That element uses its override
      ↓ Reset to Default
Back to inheriting the default
```

Overrides are stored **per surface**, so a classroom can override only its floor and keep inheriting default walls. No default asset is ever baked into geometry — shell and surface assets stay separate.

## 5. Explicitly not in this stage

Smartboard, video upload, teacher camera, tables/chairs/desks, wall frames, student interaction, live teaching, room interiors beyond the shell. The classroom shell is built so each of those can be added later as an independent component without rebuilding it.

## Technical section

**Database (one migration)**
- `building_classrooms` — id, building_id, door_id (unique, ON DELETE CASCADE), name, kind (`classroom` | `teaching_hall` | `auditorium`), `surface_overrides jsonb default '{}'`, position, timestamps. GRANTs for authenticated + service_role, RLS enabled, policies reusing `can_edit_building` / `can_view_building`.
- `building_walkways` gets `surface_overrides jsonb not null default '{}'`.
- `buildings.environment` stays as-is and becomes the named **Default Settings** record — no data migration, existing buildings look identical after this change.

**Types / resolution (`src/lib/building/`)**
- `types.ts`: `ClassroomKind`, `BuildingClassroom`, `SurfaceOverrides` (partial `SurfaceDesign` per `SurfaceKey`), classrooms added to `BuildingData`.
- New `resolve.ts`: `resolveSurfaces(defaultEnv, overrides)` merging overrides field-by-field over the default via the existing `mergeEnvironment` helpers — the single place inheritance is decided.
- New `classroom.ts`: per-kind dimensions (width/length/height, auditorium tier count, rise and run) and the shell geometry description.
- `textures.ts`: texture collection walks default plus every override so uploaded images in overrides get signed too.

**API (`api.ts`)**
- `addClassroom`, `updateClassroom`, `deleteClassroom`, `listClassrooms`; `updateWalkwayOverrides` / `updateClassroomOverrides` with a reset (delete-key) path. Duplicate-building copies classroom shells and overrides but no content, matching existing behaviour.

**Renderer (`HallwayScene.tsx` + new `ClassroomShell.tsx`)**
- Hallway surfaces read through `resolveSurfaces` instead of the raw environment; no junction, merge, door-frame, label, camera or map logic is touched.
- New `ClassroomShell` component builds the six shells from `classroom.ts` dimensions, mounted beyond its door and only when the walker is at or through that door. Doorway opening reuses the existing mouth/reveal approach so no z-fighting is introduced. Entering/leaving is camera navigation inside the same scene, not a page swap.

**Editor (`WalkwayManager.tsx`, `BuildingSettingsPanel.tsx`, `AcademyEditorPage.tsx`)**
- Add Classroom wizard (type → door → name) in the Add section; classrooms listed under their door with rename/delete.
- Settings panel gains a scope selector: **Default** or **Individual → (hallway | classroom)**, reusing the existing surface controls, gallery and upload dialogs unchanged, plus Reset to Default per surface.

**Verification**
- Typecheck, existing navigation tests (must stay green), new tests for override resolution and per-kind classroom dimensions.
- Authenticated browser walk: create one of each type on three doors, walk through a door into each shell, confirm auditorium steps descend to the front, change a default wall and see all inheriting elements change, override one classroom floor, confirm nothing else changed, reset and confirm inheritance returns after reload.
