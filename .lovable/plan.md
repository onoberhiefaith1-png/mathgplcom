# Navigation: two fixed controls, junction-aware, no visited rules

Only the navigation controls and movement behaviour change. Building generation, hallway extension, doors, and the map drawing stay as they are.

## What you will get

Two permanent buttons at the bottom of the viewport:

- **Right button — MOVE FORWARD.** Its meaning never changes. Hold to walk continuously in the direction you are currently facing; release and you stop immediately. Nothing ever moves on its own.
- **Left button — TURN AROUND.** One press smoothly rotates the view 180 degrees in place. You then hold MOVE FORWARD to walk back the way you came.

When a junction is close enough ahead of you, the left button temporarily becomes **ENTER [hallway name]**, showing which side it is on. Pressing it turns you smoothly into that hallway and normal walking continues — no teleporting, no snapping. Once the junction is behind you the button goes back to TURN AROUND.

Junctions are never "used up". Whichever direction you travel, any junction that is physically ahead of you can be entered again: A to B, turn around, back to A, into A again, loops, and repeated routes all work.

## How it works

### 1. Fixed control roles (`WalkControls`)
- Right button: always hold-to-walk, glyph and label fixed ("Hold to move forward"). Remove the facing-dependent glyph flip (currently `facing === 1 ? "▲" : "▼"`) so the arrow never changes meaning.
- Left button: single slot rendering either "Turn around" (calls `goBack`) or the current junction action (calls `pickBranch`/`crossLink` for the resolved target).
- Delete the separate mid-screen left/forward/right branch pill row; junction actions live only in the left slot. When two junctions are equally close (both sides), show the nearer one and allow a second press to cycle sides — labelled with the side arrow.

### 2. Direction-aware junction resolution (new helper in the scene)
Replace the current `nearOpenings` proximity list (which only looks at child openings on the current hallway) with a single resolver that runs each frame from machine state and returns at most one `JunctionAction`:

- Candidates on the current hallway from `layouts`: `opening` entries (child hallways), `link` entries (cross-connections), plus two implicit candidates — the forward continuation at `dist = length` and, for a branch/corridor, the parent junction at `dist = 0`.
- Keep only candidates in front of the walker: `(candidate.along - st.dist) * st.dir > -0.5`, within `ENTER_RANGE` (about 6 m).
- Choose the nearest. Parent-junction and forward-continuation candidates resolve through the existing `handleBoundary` handoff; child openings through `pickBranch`; links through `crossLink`.
- No history/visited filtering anywhere in this resolution — `NavigationHistory` stays a breadcrumb display only.

### 3. Physical entry, never teleport
- `pickBranch` keeps its pivot turn at the walker's actual position, then resumes at `junctionGeometry().branchTrim`; remove the "Keep walking to the end of the hallway" refusal for forward continuations by letting the resolver only offer that action inside `ENTER_RANGE` of the hallway end.
- Entering the parent hallway from a branch keeps the walker's world position: reuse the boundary handoff so `dist` lands on the recorded junction slot and facing turns smoothly into the parent heading (a short pivot turn rather than an instant yaw set).

### 4. Movement guarantees
- `st.hold` stays the only source of motion; `startHold` is always called with `+1` intent relative to current facing (no backward hold path), so pressing forward can never trigger an implicit about-face.
- `goBack` performs the 180° pivot only and leaves `hold = 0`, so the walker stands still after turning until forward is held.
- Reaching a true dead end sets `idle` and stops; the left button still offers TURN AROUND there.
- Backing out of the root hallway entrance keeps the existing `backToBrowse()` exit.

### 5. Map
`MiniMap` keeps its current GPS follow behaviour; the route highlight switches from the parent chain to the actual walked chain so loops read correctly. No other map changes.

### 6. Verification
- Extend `src/lib/__tests__/buildingNavigation.test.ts` with unit tests for the junction resolver: ahead-only filtering in both travel directions, re-entry of an already visited junction, parent-junction visibility when travelling back, and link candidates.
- Playwright pass on `/academy`: hold forward from the entrance, confirm no motion when released, enter a right branch, turn around, walk back, confirm the left button reads ENTER for the original junction and entry succeeds.
