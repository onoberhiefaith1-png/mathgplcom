# Fix the Academy Back Control

## Goal
Make the on-screen Back control perform a reliable 180° about-face and let the user retrace the maze without becoming stuck.

## Confirmed issue
The Back control currently starts a 0.45-second turn on pointer-down, but pointer-up immediately clears the held movement intent. A normal click therefore completes the camera turn without continuing backward. The control also always renders the same down-arrow glyph, so it does not visibly confirm the new facing direction.

## Implementation
1. Separate **turn around** from **hold to walk** in the navigation state machine.
   - A Back click always completes one 180° turn at the user's exact position.
   - It must not depend on the pointer remaining held for the duration of the animation.
   - Repeated input during the turn will be ignored safely rather than canceling or reversing the turn.

2. Make movement relative to the direction the user is facing.
   - After the about-face, Forward moves in the newly faced direction.
   - The opposite-direction control can turn the user around again.
   - Releasing a movement control stops movement immediately; no automatic travel is introduced.

3. Make the Back control communicate its state.
   - Rotate/update the directional arrow after the 180° turn so it points in the direction of travel.
   - Keep accessible labels synchronized with the action.
   - Preserve keyboard support for Arrow/WASD controls.

4. Preserve full route retracing.
   - Verify reverse handoffs from child hallway to parent at the original junction.
   - Verify reverse traversal through connector corridors and looped hallways.
   - At the building entrance, reverse travel returns cleanly to the browse/entrance state rather than trapping the camera.

## Verification
- Add focused navigation-state regression coverage for click-to-turn, release-during-turn, forward-after-about-face, parent-junction retracing, and connector retracing.
- Run the existing building geometry/navigation tests and TypeScript validation.
- Use the live 3D Academy to verify: click Back → camera turns 180° → arrow updates → hold Forward → walker retraces the same road → release stops immediately.
