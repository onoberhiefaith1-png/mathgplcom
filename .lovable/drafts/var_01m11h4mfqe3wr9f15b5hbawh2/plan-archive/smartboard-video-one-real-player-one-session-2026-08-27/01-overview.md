# Smartboard video: one real player, one session

The teaching video already loads a real `<video>` element — it is never turned into a screenshot. What is missing is the *single shared controller* behaviour: today the pane keeps its own copy of playback intent, the Introduction/Conclusion triggers are effect-driven (so they can fire on re-render), Present and Floating Numbers are only loosely tied to the video, teacher test state can carry over, and the control rows still collide on narrow screens.

This plan turns the pane into one central video controller with explicit segment state, and connects it to every control that should move it.

## What changes

1. **One controller, three views.** Playback state (`currentTime`, `isPlaying`, `volume`, `muted`, `activeSegment`) lives in a single controller hook that owns the one mounted `<video>`. Switching Smartboard / Split / Video never remounts it, never reloads the source, never restarts from 00:00, and never stops the audio.
2. **Segments are timestamp ranges in one file.** Introduction, each mathematical line, and Conclusion each have a `start`/`end`. Playback stops exactly at `end` — however long the range is (10 minutes, 20 minutes, an hour) — and never spills into the next section.
3. **Mathematics has priority.** Activating a line — via a Floating Number, via Present, or via the board's own cursor — immediately seeks to that line's `start` and plays it, interrupting whatever was speaking (including the Introduction). No waiting for the current section to end.
4. **Present ↔ Floating Numbers ↔ line ↔ video** stay one selection. The board's existing single line cursor remains the source of truth; the video follows it.
5. **Mark-aware replay.** A line whose mark is already awarded does not auto-replay when the student returns to it. An unawarded line does. The player's Previous / Next / Replay always work and never touch marks.
6. **Introduction / Conclusion.** The Introduction starts once when the board opens and stops at Line 1's start if untouched. The Conclusion fires only on the *marking event* of the final line — not on visiting it, and once per session.
7. **Audio is on by default** in all three views, with a volume icon, slider and mute/unmute that apply instantly and persist across view switches without reloading the video.
8. **Teacher test mode resets** on every entry: no marks, no played-segment memory, no student progress written.
9. **Control layout.** Back / Practice / Discuss on row 1, the Smartboard / Split View / Video switch on row 2, player controls inside the player. No overlap on phone, tablet, laptop or a smartboard display.
