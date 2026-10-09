# Make the Energy Ball actually fire its collectors

The ball reaches the centre and spins, but no collectors fly out. The cause hasn't been confirmed yet, so step 1 is to sign in and watch it happen.

## Steps
1. **Reproduce while signed in.** Open your Imagine game in a test browser, place or reach an Energy Ball with other rewards on lines 1–4, activate it, and take screenshots every ~200 ms during the 3-second spin. Record which rewards on screen it treats as targets.
2. **Find the exact cause.** Possible causes, in the order they'll be checked:
   - no target is found: on-screen rewards are not seen as waiting/visible (their state, or how their screen position is read)
   - collectors are created but don't show: hidden behind the board, removed too quickly, or launched from the wrong spot
   - the firing timers are cleared when the ball's own animation ends
3. **Fix only the cause found.** Then, during the 3-second spin, each eligible reward on screen gets one collector. It leaves the centre of the spinning ball, points along the exact angle to its target (any angle), travels in a straight line, and activates that reward when it arrives.
4. **Keep the rule.** Every reward can be hit except the Hourglass Timer and the Completion Coin. The Vault, Life, Calculator, bombs and other Energy Balls are all included.
5. **Check again in the browser.** Confirm with screenshots that the collectors visibly fly at different angles and that each target activates. Typing and line changes must stay smooth. The original Game stays untouched.
