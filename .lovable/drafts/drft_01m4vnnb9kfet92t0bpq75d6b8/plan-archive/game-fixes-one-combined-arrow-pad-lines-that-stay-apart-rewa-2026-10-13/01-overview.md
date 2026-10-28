# Game fixes: one combined arrow pad, lines that stay apart, rewards back

Three things, in this order of importance.

## 1. One combined control (no more separate size box)

- The separate writing-size box at the bottom (up arrow, "120%", down arrow) is removed. It was sitting on top of the Floating Numbers.
- Its two arrows join the round arrow pad:
  - the **bigger writing** arrow sits directly under the pad's **up** arrow
  - the **smaller writing** arrow sits directly under the pad's **down** arrow
- The percentage is not shown anywhere.
- The size arrows are smaller and in a slightly different style from the cursor arrows, so the two kinds are easy to tell apart. Each still greys out at its limit (100% smallest, 200% biggest), and the chosen size is still remembered on the device.
- The pad is now taller, so the limits for dragging and resting it are recalculated: it always stays above the Floating Numbers strip and below the top bar on phone, tablet and desktop.
- This only applies inside the Game. The Smartboard's arrow pad does not change.
