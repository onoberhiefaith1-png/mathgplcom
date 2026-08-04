# Loop-Based Object Visibility (Video Adventure)

The orange Loop becomes a room: everything created inside a Learning Point exists only while the blue playhead is inside that loop's time range — in the editor and in gameplay.

## What already holds

Objects are already owned by exactly one Learning Point: each loop is stored as its own stage with its own `elements`, and gameplay already shows only the current stage's objects and clears them when the loop is cleared. Ownership is automatic — the teacher never types loop times onto an object.

## What changes

### 1. Editor: playhead drives visibility

- Track whether `videoTime` sits inside a loop region.
- When the playhead is inside a loop, that loop becomes the selected loop automatically and its objects render on the canvas exactly where they were placed.
- When the playhead is outside every loop, the canvas shows only the background video — reward, progress bar, time bar, effects, characters, floating objects and question markers all unmount, and the current selection is dropped so no stale settings panel stays open.
- Objects from a different loop never render; entering loop 2 shows only loop 2's objects.
- This reacts in real time to scrubbing, dragging the playhead and normal playback — no reload.
- A small canvas hint reads "Outside a Learning Point — objects hidden" when nothing is showing, so a blank canvas never looks like lost work.

### 2. Placing objects stays inside a loop

- Adding any object while the playhead is outside every loop is not silently dropped into an invisible loop. The editor seeks the playhead to the selected loop's start (making it visible again) and then adds the object to that loop.
- The existing gate stays: with no loop yet, only video upload and Set Start / Set End are available.

### 3. Gameplay: confirm and tighten

- While the video plays between loops, no loop objects render.
- On entering a loop region, that loop's objects appear and the region loops.
- On completion, the reward leaves, every object of that loop unmounts, and the video resumes to the next loop; a cleared loop is never re-entered and its objects never reappear.
- Only the final loop opens the Class Gallery.

## Technical notes

- `src/lib/games/types.ts`: reuse the existing `checkpointAt(scenes, t)` lookup — no schema or data-shape change; loop ownership is positional in `scenes[]`.
- `src/pages/GameEditorPage.tsx`:
  - derive `playheadLoop = checkpointAt(checkpoints, videoTime)` and `insideLoop = playheadLoop?.id === activeScene?.id`;
  - in video mode, feed `GameCanvas` an empty element list when the playhead is outside the active loop; keep the full list otherwise;
  - auto-select `playheadLoop` when the playhead enters a different loop; clear `selectedId` when leaving a loop;
  - object-add handlers seek to `activeScene.loopStart` when the playhead is outside.
- `src/pages/student/GamePlayPage.tsx`: keep the existing stage machine; only add the guard that objects of cleared loops stay unmounted after the video resumes.
- No database migration.
