# Make Create Hallway / Create Door work, and fix the map orientation

Three problems: creating a hallway does nothing visible, the door form has no Create button (and drops the name you typed), and the map's direction reads the wrong way.

## 1. Create Hallway must create — and say so when it can't

Confirmed from the database: the building still has exactly one hallway ("Entrance Hall"), so no branch has ever been written. The table, its columns (`parent_id`, `direction`, `junction_at`) and its access rules are all in place, so the failure is on the write path in the app, not the schema. The exact cause is not confirmed yet, so the first step is to make the failure visible instead of silent:

- Wrap the create action in error handling that shows a clear message ("Could not create hallway — <reason>") instead of the current silent swallow, and log the raw error.
- Reproduce the click in a signed-in browser session with that handling in place, read the actual reason, and fix it.
- Then confirm the row is written by reading it back from the database.

Regardless of the root cause, these hardening changes go in:

- The Create Hallway button is only disabled for a genuine reason (busy, or that direction already taken), and when disabled it explains why.
- After a successful create: the panel closes, the hallway list gains the new row, the 3D world rebuilds, the map draws the new branch, and the editor camera moves to the junction — all without a page reload.
- Direction stays Left / Right only (a road is never extended by hand). Any stale "Forward" button in the form is removed.

## 2. Add Door gets a real Create Door button

Today a door is created by clicking a product row in a list — there is no Create Door button, which is why the form feels unfinished. New behaviour:

```text
ADD DOOR
On hallway:  [ Entrance Hall v ]
Door name:   [ Statistics ]
Door design: [ Building default v ]
Opens:       [ Course | Game | Adventure | Assessment ]  -> pick one (selected, highlighted)
                                 [ Create Door ]  [ Cancel ]
```

- Picking a product selects it (highlighted) rather than instantly creating.
- **Create Door** performs the write; it is disabled until a hallway and a product are chosen, and it reports failures the same way as above.
- Confirmed bug: the typed door name is currently dropped because the form sends `title` while the writer expects `title_override`. The name will be saved and shown on the door sign and in the list.
- After creating: the door appears in the hallway's list, on the 3D wall, and as a marker on the map, and the road lengthens automatically.

## 3. Map: turn it the right way round and keep it live

- The plan's floor plan is entrance at the **bottom**, travel reading **upward** (south to north). The geometry already places the entrance at the bottom, but the player's facing chevron uses an inverted y sign, so the arrow points the opposite way to the travel — which reads as north to south. The chevron will use the same y mapping as the lines so position and facing agree.
- The whole map is re-derived from the same compiled hallway graph the 3D world uses, so creating a hallway immediately draws the perpendicular branch line and node, and creating a door immediately draws its marker — no reload. Renames and deletes update the same way.
- The frame stays fixed top-right and never rotates; only the position marker and its chevron move.

## Technical notes

- `src/components/academy/editor/WalkwayManager.tsx`: try/catch + inline error text on both forms; Create Door button with selected-product state; door payload key corrected to `title_override`; disabled-reason hints.
- `src/pages/academy/AcademyEditorPage.tsx`: `handleAddWalkway` / `handleAddDoor` surface errors via toast and re-throw for the form; keep the existing `navigateTo` camera move.
- `src/lib/building/api.ts`: `addWalkway` / `addDoor` return the created row (not just an id) so the world can update optimistically and a swallowed error becomes impossible.
- `src/components/academy/world/HallwayScene.tsx` (`MiniMap`): chevron y sign matched to `py`; verify branch and door markers regenerate from `segments` / `layouts` on every data refresh.
- No migration needed — `building_walkways` already has `parent_id`, `direction`, `junction_at`, `name`, `end_label`.

## Verification

- Unit tests for the hallway graph stay green; typecheck clean.
- Signed-in browser pass: create a Left hallway off Entrance Hall -> row written in the database, branch visible in 3D and on the map in the same step; create a door with a name -> name persists on the sign and in the list; walk in and back out; reload and confirm everything persisted.
