# Narration keeps playing while the video loops

The last change treated a loop edge as a wall for sound. That was wrong. The loop belongs to the video, not to the narration.

New rule: once a narration starts, it plays on its own clock until it finishes naturally. The video may cross the loop start or loop end any number of times while that happens — no stop, no restart, no rewind.

## What changes

1. **No cutting at loop edges.** The "allowed window" idea is removed. Nothing stops a clip because the playhead reached a loop boundary or wrapped back.
2. **A loop cycle is one stage, not new timeline progress.** While a Learning Point is active, wrapping from loop end back to loop start is not forward movement, so no narration is retriggered by it and no clip assigned after the loop is triggered by the wrap.
3. **Clips after the loop wait for real progress.** A clip pinned past the loop end only speaks once the point is completed and the playhead genuinely travels past that timestamp.
4. **A clip inside a loop speaks once per activation.** Play Once speaks the first time its point becomes active in the run; Repeat speaks again each time the point is re-entered — neither is re-fired by a lap.
5. **Scrubbing still stops sound.** A deliberate seek by the teacher remains a stop, because that is not a loop lap.

## Gallery

Reverted out of this task. The Gallery tile goes back to showing for every teacher as before, and no further Gallery work happens here.

## Kept as already built

Region-aware Reward / Progress Bar / Timer / Effects controls, the active Learning Point label, dormant uploaded clips until selected, and preview showing only the live point's controls all stay exactly as they are.
