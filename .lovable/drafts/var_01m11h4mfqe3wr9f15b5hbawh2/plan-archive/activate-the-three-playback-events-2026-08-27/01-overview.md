# Activate the Three Playback Events

This is a sequence correction only. It does not redesign the editor, video segments, player, Smartboard, Floating Numbers, or marking system.

## Required behaviour

1. **Board opens or restarts**
   - If an Introduction is enabled and has a playable range, select it as soon as the video is ready and start it automatically.
   - Do not mark the Introduction as started until a real `<video>` element has accepted the playback attempt.
   - If there is no Introduction, remain paused and wait for Line 1 activation.
2. **Hashtag activates Line 1**
   - Clicking the visible `#` Floating Numbers button is a real line activation, even when the cursor is already resting on Line 1.
   - It immediately interrupts the Introduction, seeks to Line 1’s segment, and plays it.
   - Floating Numbers, Present, Next, and Previous continue to use the same active-line cursor.
3. **Final mark activates Conclusion**
   - Only a newly awarded mark on the final line starts the Conclusion.
   - Merely visiting the last line does nothing.
   - Once started, the Conclusion is not interrupted by a late line-context update and plays to the end of the video.
4. **Restart means a new playback sequence**
   - Reset/restart clears the player’s Introduction, handled-line, and Conclusion one-shot guards, then starts the Introduction again when configured.
   - Existing marks remain governed by the current reset rules; this change only resets playback orchestration.

## Browser audio rule

The player will first request immediate playback with the saved/default audio setting. Browsers may legally reject sound-on autoplay before any user gesture; in that case the Introduction must still begin muted and expose the existing one-tap sound control. After the first gesture, normal audible playback continues. The lifecycle bug must never leave the player paused at `0:00` merely because metadata or sound permission was not ready.
