## Interaction details

1. **Resolve the shared Flow scenes**
   - Read the linked Flow’s single Base scene and its Emotion scenes.
   - Keep the selected completion outcome as the opening reaction; once it ends, continue with Base.

2. **Use the Lesson Note playback cycle**
   - Base restarts automatically whenever its range ends.
   - An emotion interrupts Base immediately, plays once, then returns to Base.
   - Additional rapid taps follow the existing Lesson Note reaction ordering rather than leaving the character blank.

3. **Add the movable emotion control**
   - Wrap the same emotion bar used by Lesson Notes in its own drag/resize control.
   - Default it to the circled lower-left position without covering Continue.
   - Store its position and scale separately from the character’s Game-only position.

4. **Respect creator and student permissions**
   - Creator preview: character and emotion strip are draggable/resizable.
   - Student completion screen: the same emotion buttons work, but movement and resizing are locked.

## Verification

- Confirm Base visibly loops before and after reactions.
- Confirm each emotion plays and returns to Base without a blank/still frame.
- Confirm creator drag/resize persists after Save and reload.
- Confirm students see and operate all enabled emotions but cannot move controls.
- Check desktop and phone layouts so the emotion strip stays usable and does not obstruct completion actions.
