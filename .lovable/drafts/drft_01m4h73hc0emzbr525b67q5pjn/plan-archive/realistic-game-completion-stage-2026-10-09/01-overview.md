# Realistic Game completion stage

## Goal
Rebuild the current plain completion overlay to closely match the supplied reference while preserving each Game’s own world and Flow character.

- The Game’s existing background remains full-screen and clearly visible, with lightweight celebratory lighting and confetti rather than a replacement castle scene.
- A gold-framed central results board carries the Game’s question progress, three realistic stars, the completion title, earned rewards, and the two large actions.
- The screen pauses progression. The student must select **Continue** before the next question; **Exit Game** leaves through the existing safe exit flow.
- The completion screen remains responsive and lightweight on phones, tablets, and smartboards.

## Motion sequence
1. The results stage enters over the Game world.
2. The three dimensional gold stars rise and illuminate individually: left, centre, right.
3. Each visible reward starts at zero and counts to the exact earned value.
4. The Game’s configured Flow character plays its matching celebration segment beside the board.
5. Continue and Exit remain stable and usable throughout.

Reduced-motion devices receive the final state immediately, without losing any information.
