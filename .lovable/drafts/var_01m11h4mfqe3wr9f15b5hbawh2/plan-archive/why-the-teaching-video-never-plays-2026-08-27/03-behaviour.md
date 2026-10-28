## What changes

**The saved video plays without re-editing.** Any section read back with `end <= start` is repaired the moment it is read: its start becomes the previous section's end. So the existing Practice Set A video immediately becomes intro 0–17.6, Line 1 17.6–40.4, Line 2 40.4–88.7, Line 3 88.7–138.2, conclusion 204.5–255.6.

**Marking a boundary in the editor.** Each section shows one **End at playhead** action; its start is displayed, read-only, as the boundary above it. This makes a collapsed range impossible to create. A section whose end is not after its start is flagged in red with "no duration" and the Save button explains it before writing.

**Playback safety net.** If a section still has no duration, the player treats it as running to the next boundary rather than pausing on arrival, and the control bar shows the real remaining time instead of `0:00 / 0:00`.

**Nothing else moves.** One uploaded file, timestamp slices only. Introduction on open, line activation interrupting it, mark-aware replay, the Conclusion on the final mark, the audio state and the three view modes all stay exactly as they are.

## How I will verify it

I run the student board in a real browser against this preview, on the question that already has the video, and confirm: the Introduction plays with audio and stops at 17.6 s; activating Line 1 seeks to 17.6 and plays through to 40.4; the clock reads a real duration; a view switch to Split and back does not restart or mute it.
