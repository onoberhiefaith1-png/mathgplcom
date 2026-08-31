# Hallway walking + expandable-road hallways

Two separate steps, in order. Step 1 touches movement only. Step 2 touches placement/length only.

---

## Step 1 — Smooth hold-to-move first-person walking

### What is happening now (verified in code)

- `WalkControls` Forward is a **toggle** (`onToggleWalk`): one click starts continuous automatic walking, another stops it. So the player moves without holding anything.
- Keyboard `ArrowUp` / `W` sets `moving = true` but there is **no keyup handler**, so once pressed the camera keeps travelling on its own.
- Entering the building calls `enterWalk(...)` with `moving: true` — movement starts automatically.
- The walk **auto-stops** at every junction (`stops` + `handleJunctionReach`) and at the hallway end, whether or not the user let go.
- Turning into a branch (`pickBranch`) sets `dist = 0` on the new segment and plays a camera zoom to the branch start — this is the segment-to-segment jump.

### Target behaviour

- Camera never moves unless Forward is actively held (pointer/touch held, or `ArrowUp`/`W` key held).
- Holding accelerates smoothly to walking speed; releasing decelerates to a stop within a fraction of a second and the position is kept.
- Holding again resumes from exactly that position — no reset of `dist`, no snap.
- Junctions no longer force a stop; the player may walk past them. Left/Right remain offered while alongside an opening, exactly as today.
- Turning into a branch keeps continuity: the camera walks/glides through the junction throat into the branch and its distance along the branch starts from the geometric point it actually reached, not 0.
- Existing wall/boundary clamping (`dist` clamped to `[0, segment length]`, lateral position on the corridor axis) is preserved.

### Changes

1. `Machine`: add `holding: boolean` (input intent) and keep `speed` for the ramp. `moving` becomes derived from `holding`.
2. `CameraRig` walk branch: target speed = `holding ? WALK_SPEED : 0`, ramped with `Math.exp(-k * dt)` damping; advance `dist` by `speed * dt`, clamped to segment length. Remove the "ease to the next junction stop" clamp so junctions do not brake the walk; keep the terminal-wall clamp.
3. `WalkControls`: Forward becomes a press-and-hold control — `onPointerDown`/`onPointerUp`/`onPointerLeave`/`onPointerCancel` (plus `onTouchStart/End`), calling `onHoldStart` / `onHoldEnd`. Visual state shows "held" rather than "playing".
4. Keyboard: add a `keyup` listener releasing the hold for `ArrowUp`/`W`; `keydown` sets the hold (with repeat ignored). Left/Right/Back keys keep current meaning.
5. `enterWalk` starts with `holding = false` so nothing moves until the user presses Forward. Remove the auto-start effect's implicit movement (still enter walk phase, just stationary).
6. `handleJunctionReach` no longer stops the walk (junction proximity only drives which turn buttons show). `handleWalkEnd` still eases to a stop at the terminal wall.
7. `pickBranch` for side hallways: instead of `dist = 0` + zoom-to-start, seed the branch distance from the junction solver (`junctionGeometry().branchTrim`) so the camera continues from where it stands, and yaw eases to the branch heading over ~0.35 s. Forward continuations already carry on and stay as-is.

### Acceptance test (Step 1)

Hold Forward → continuous smooth travel. Release → stops within ~0.2 s and stays. Hold again → continues from that spot. No movement when nothing is held. Walking past/into a junction never teleports.

---

## Step 2 — Hallways as continuously extending roads with equal spacing

### What is happening now (verified in code)

- Every new door is inserted with `position_along: 0.5` (`WalkwayManager.submitDoor` → `api.addDoor` default), so doors have no real order of their own.
- `nextObjectOffset` caps the next offset at `0.94`, so after roughly six objects every new object piles up at the same offset.
- `layoutHallwayObjects` spreads objects **evenly across the hallway length** (`gap = usable / count`), so spacing changes as objects are added instead of being a fixed distance.
- `freeBranchDirections` allows at most one left and one right branch per hallway — unlimited branches on one hallway are not possible.
- Hallway length is already derived (`derivedLength` / `lengthForObjects`), which is the right model; it just needs to key off a fixed spacing rather than being redistributed.

### Target behaviour

- A fixed `SPACING` (7.5 m) between consecutive objects on a hallway — door→door, door→junction, junction→junction all identical.
- Adding a door places it at the next free slot (`pad + n * SPACING`); adding a hallway places its junction at the next slot on the same sequence, so doors and branches interleave in creation order.
- Hallway length grows automatically to fit the highest occupied slot plus end clearance — unlimited doors and unlimited branches, no fixed segment count and no arbitrary maximum.
- Branch hallways behave identically and recursively (branch → doors → branch → doors …), each branch owning its own slot sequence.
- Branches keep alternating right → left and never overlap the parent: the 60° junction solver, `branchTrim` and `wallRuns` stay the source of truth.

### Changes

1. `navigation.ts`
   - Replace the even-distribution rule in `layoutHallwayObjects` with slot placement: sort by stored order, then `along = pad + index * SPACING`; keep the wall-side alternation and the opening-side rule.
   - Replace `nextObjectOffset` with a slot-index helper (`nextSlotIndex` / `slotFraction`) that returns an uncapped ordering value; hallway `junction_at` and door `position_along` become normalized positions of that slot rather than hand-tuned fractions.
   - `lengthForObjects` keys off the highest slot index: `pad * 2 + (maxIndex + 1) * SPACING`.
   - Drop the one-left/one-right restriction in `freeBranchDirections` (or retire it) so a hallway can take unlimited branches; `nextBranchDirection` keeps alternating sides.
2. `WalkwayManager` / `AcademyEditorPage`
   - Door creation passes a real `position_along` from the next slot instead of `0.5`.
   - Hallway creation passes the next slot for `junction_at`.
   - Both count doors **and** branches on the target hallway so the two share one sequence.
3. `HallwayScene`
   - `derivedLength` uses the slot-based length; drop the special root `rootLen` override so root and branches use the same rule.
   - Junction openings and doors keep reading `layouts`, so the 3D corridor, walls, gaps and minimap all extend together with no further changes.
4. Tests in `src/lib/__tests__/buildingNavigation.test.ts`: constant spacing across many objects, interleaved door/hallway sequences, unlimited branches on one hallway, derived length growth, and branch recursion.

### Acceptance test (Step 2)

Add Door → Door → Door → Hallway → Door → Hallway on the main hallway: spacing between consecutive objects is identical, the corridor visibly lengthens each time, branches alternate sides and never overlap the parent. Repeat inside a branch with the same result.

---

## Notes

- Step 1 changes only movement/input; Step 2 changes only placement and derived length. No changes to wall/floor/ceiling design, door assets, environment settings, or the map's look.
