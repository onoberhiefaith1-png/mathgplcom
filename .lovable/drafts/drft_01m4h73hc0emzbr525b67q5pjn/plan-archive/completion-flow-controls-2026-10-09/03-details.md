## Implementation details

1. **Front-layer character**
   - Adjust the completion scene's layer order so the character and its reaction controls sit above the complete panel while the background and confetti retain their current order.
   - Keep completion buttons usable wherever they are not visually covered by the creator's chosen character position.

2. **Creator-only placement controls**
   - Reuse the Smartboard's `DraggableResizable` interaction around the completion character in Game Flow preview mode.
   - Save the final horizontal position, vertical position, and scale into this Game's existing completion Flow settings.
   - Keep the existing placement sliders synchronized as an alternative precise control.

3. **Shared reaction-key experience**
   - Reuse the Smartboard Flow reaction-bar presentation and the same emotion scenes sourced from the selected shared Flow.
   - Show and operate it in creator preview mode.
   - Show it to students during completion when student reactions are enabled; reaction taps replay only the chosen character scene and do not advance or alter rewards.
   - Do not expose move/resize controls to students.

4. **Verification**
   - Check creator preview: character overlaps the panel from the front, drag persists, plus/minus resize persists, and every reaction key plays.
   - Check student completion: same saved placement and keys, no editing controls, Continue/Exit remain usable.
   - Check desktop and phone layouts and run the focused checks for Game completion and Flow behavior.
