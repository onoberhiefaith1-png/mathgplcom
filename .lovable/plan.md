# Cinematic Adventure Portal Sequence

Two changes to `src/components/adventure/AdventurePortalScene.tsx` — both stay in the existing scene component, no new files needed.

## 1. Balloon expansion (all segments at once)

Right now only the clicked segment scales/pushes forward, so the building looks torn off the rest. Change it so when a segment is selected, every segment of the cylindrical city expands outward simultaneously from the world centre — like inflating a balloon — while the camera still ends up framed on the chosen door.

- Add `getWorldExpand()` returning the approach progress (0→1) of the selected segment, regardless of index.
- In `WorldSegment.useFrame`, every segment reads `worldExpand` and uniformly scales its radius outward (`scale.set(1 + worldExpand*0.32, 1 + worldExpand*0.32, 1 + worldExpand*0.32)` on the group, but applied to non-selected segments too).
- Non-selected segments still fade (existing `getOpacity`) but they expand in place first so the structure reads as one balloon, not a detached slice.
- The selected segment keeps its small extra forward push (`position.z`) and texture-zoom to the door so the camera lands on the door. The central core also scales with the balloon before fading.

Net effect: click any academy → the whole ring inflates outward in unison, then the non-selected slices fade as the camera locks onto the chosen door.

## 2. Cinematic door-open sequence

Replace the current pause → magic-ball-storm jump with a 3-stage DOM overlay sequence on top of the existing `pause` phase. Add new stages to the `effectStage` state machine in the parent `AdventurePortalScene`:

```text
idle → lightning (2.0s)  → storm-grow (2.6s) → storm-cover (0.35s)
     → transition (1.2s) → done
```

Timings (driven by `setTimeout` like the existing storm code):

| Stage         | Duration | Asset                            | What plays                                                                                  |
| ------------- | -------- | -------------------------------- | ------------------------------------------------------------------------------------------- |
| `lightning`   | 2.0s     | `thor_lightning_overlay_11.mp4`  | Fixed-size video framed on the door (≈40vmin square, centred), `mix-blend-mode: screen`. Crackles on the door frame.  |
| `storm-grow`  | 2.6s     | `magic_ball_storm.mp4`           | Existing grow-from-door-to-fullscreen behaviour (kept as-is).                                |
| `storm-cover` | 0.35s    | same                             | Fully covers; underlying image swaps to staircase hall (existing behaviour).                 |
| `transition` | 1.2s     | `half_dome_shockwave.mp4` + `magic_energy_burst_pink.mp4` stacked | Storm fades out while a fullscreen shockwave + pink burst flash play over the new scene to "land" into it. |
| `done`       | —        | —                                | All overlays unmount, staircase hall fully visible.                                          |

Implementation details:

- Import the three new asset JSONs (`thor_lightning_overlay_11`, `half_dome_shockwave`, `magic_energy_burst_pink`).
- Move the existing storm sequence so it kicks off only after `lightning` ends instead of on `onDoorReady`.
- Render each overlay video conditionally based on `effectStage` with `pointer-events-none`, `position: absolute inset-0`, `z-50`, `mix-blend-mode: screen`, `autoPlay muted playsInline`.
- The lightning overlay is sized/positioned to sit on the door (use `aspect-square h-[42vmin] w-[42vmin]` with a small `translateY` to align with the door arch — same anchor the storm uses).
- The transition overlays (`half_dome_shockwave` + `magic_energy_burst_pink`) cover the full viewport (`object-cover h-full w-full`) and fade in/out via opacity transitions.
- Keep existing `revealed` whiten-fade that finishes the staircase reveal.

## QA

- Click each academy in turn (Statistics, Algebra, Geometry, etc.) and verify: balloon expansion is symmetrical, lightning plays on the door first, storm grows from door centre, transition VFX bridge cleanly into the staircase hall, no jump cuts.
- No console errors; videos autoplay (muted + playsInline already set).
