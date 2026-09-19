# Why Adventure audio plays only sometimes

I traced the sound path used by Play, Preview and the timeline. The files are fine — five separate faults in the runtime explain every "it worked last time" case.

1. **Only one clip can be heard at a time.** All sound goes through a single player. When a Learning Point opens, every clip pinned inside it is started in the same instant, so each one immediately replaces the one before it and only the last is audible. The clips that were silently replaced are still marked as "already played", so they never speak at their own moment either. This is the missing order.

2. **Play does not switch sound on.** Browsers only allow sound after a real click. Preview asks for permission; the plain Play button does not. So Play is silent until something else in the session happens to grant it — and then the clips that were waiting all burst out at once.

3. **Pausing wipes the audio's memory of where it was.** Pause resets the remembered position to zero. On resume, the runtime believes the playhead jumped from the very beginning to the current moment, treats every earlier clip as just crossed, and fires them all together — again only the last is heard.

4. **Entering a Learning Point cuts sound that does not belong to it.** A clip placed just before a loop is stopped the moment the loop becomes the active stage, even though it belongs to the timeline before it.

5. **A clip that fails to load fails silently.** If its address cannot be prepared, nothing plays and nothing is reported, which looks random from outside.

## The rule after the fix

One sound controller owns current clip, queue, position, play, pause, seek and loop state — shared by Play, Preview and timeline scrubbing.

- Clips due at the same time are played **one after another**, in timeline order, never on top of each other.
- Once a clip starts it runs forward on its own clock. The video may lap its loop as often as it likes: no restart, no rewind, no stop.
- Pause holds the clip and its position; resume continues from exactly there.
- Leaving a Learning Point (passed, failed, skipped) stops only the sound that belongs to that point.
- A deliberate scrub stops sound, then the clip for the new position takes over.
- Newly uploaded audio behaves exactly like existing audio.
