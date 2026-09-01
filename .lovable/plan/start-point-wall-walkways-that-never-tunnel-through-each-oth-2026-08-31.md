# Start Point wall + walkways that never tunnel through each other

Three changes to the building, nothing else touched.

## 1. START POINT — a structural component of its own

Today the wall behind you at the entrance is not a designed surface at all: it is a
plain coloured plane that borrows the Left Wall's colour. So when you turn around and
look back, there is nothing to design.

- Add **Start Point** as a sixth surface alongside Left Wall, Right Wall, Floor,
  Ceiling and Terminal Wall.
- It gets its own section in the Building Settings panel, with the same gallery,
  upload, zoom / move / fit / brightness controls as every other surface.
- It renders on the wall that caps the entrance of the main hallway only — never on
  branch hallways, never on terminal walls.
- Existing buildings keep their current look: Start Point inherits Terminal Wall, then
  Left Wall, before falling back to the default. Nothing changes visually until the
  owner edits it.

## 2. Walkways can never cross through one another

Right now crossings are handled visually — the decks are cut and offset so they stop
flickering — but a new walkway can still be extended straight *through* an existing
one. That is the remaining structural problem.

New rule: **when a growing walkway reaches an existing walkway, it stops at that
boundary and merges into a junction.**

- A merge solver walks every pair of hallway footprints and finds the first place a
  hallway would enter another one.
- The arriving hallway is trimmed to the edge of the hallway it met, and a real
  junction mouth (opening in the wall, continuous floor and ceiling through the
  throat) is inserted where they meet.
- The navigation graph gains a two-way edge at that junction, so loops still work in
  both directions — you can walk in and back out.
- Because the arriving hallway is now shorter, the editor refuses door/slot additions
  that would push it past the merge point, with a clear message ("this hallway ends at
  its junction with X"). No silent tunnelling, no auto-extension past the boundary.

```text
before (tunnelling)              after (merge)
   ====A====                        ====A====
       ||                               ||
  --B--++--B--                    --B--+#  (B stops, junction mouth)
       ||                               ||
```

## 3. Entrance controls and labels

- Turn Around / Forward are live from the moment you enter (standing in the lobby
  already counts as being in the building) — confirm and fix any path where the first
  press is ignored.
- Fragmented / flickering nameplate text: the plaques get a solid backing and a fixed
  draw order so glyphs never break up or fight the wall behind them.
- Editor controls stay mounted when switching between surfaces (Floor, Ceiling, Start
  Point), so the panel never blanks out mid-edit.

## Technical notes

- `src/lib/building/types.ts` — `startWall` added to `SurfaceKey`,
  `EnvironmentSettings`, `DEFAULT_ENVIRONMENT`.
- `src/lib/building/env.ts` — `mergeEnvironment` fallback chain
  `startWall -> endWall -> leftWall -> default`.
- `src/components/academy/editor/BuildingSettingsPanel.tsx` — "Start Point" section +
  `SURFACE_TITLES` entry.
- `src/components/academy/world/HallwayScene.tsx` — the `capStart` plane becomes a
  full `Surface` driven by `env.startWall`; nameplate materials get `depthWrite` and an
  explicit `renderOrder`.
- `src/lib/building/navigation.ts` — new `solveHallwayMerges` returning per-hallway
  trim length + junction anchor, consumed by `compileNavGraph` (bidirectional edge) and
  by `hallwayLength` / the editor's growth guard.
