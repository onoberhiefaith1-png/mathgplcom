# The loop is an environment — everything inside it dies on exit

## What the code does today (verified)

- Narration currently runs on its **own clock**: once a clip starts, laps of the looping video never touch it, and nothing stops it when the student passes the Learning Point. So a 1-minute clip keeps talking underneath the next stage. That is the bug.
- Narration is only alive **while Preview is running**: in the editor the runtime is switched on by `preview.active`, so the ordinary Play button moves the video with no narration, no stage music, no effects.
- In the Narration Library each clip has one Play button that always restarts the clip from the beginning — there is no Pause/resume, and one clip can be assigned to a second position with no warning that it is already assigned somewhere.

## The rule this change installs

A Learning Point loop is a **stage**, not a repeated clip. Anything assigned inside it belongs to it.

- While the stage is live and the video laps: narration keeps playing forward, never restarting, never rewinding, never cut at the loop edge.
- The instant the student passes (or fails, or the stage is otherwise left): the loop video, the stage narration, stage music and stage effects all stop at once, the stage is cleared, the timeline moves on, and narration belonging to the next segment starts at its own position.
- Repeat clips repeat only inside their own stage; they never repeat past the exit.
