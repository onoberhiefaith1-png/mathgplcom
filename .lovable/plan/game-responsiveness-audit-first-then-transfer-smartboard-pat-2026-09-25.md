# Game responsiveness: audit first, then transfer Smartboard patterns

Goal: the Game keeps every feature it has now, but each tap, drag, write and scroll should respond as instantly as on the Smartboard. We measure first and change only what the measurements point to.

## What we already know
- The Smartboard draws its writing on normal page elements over one continuous surface.
- The Game draws its room and writing surfaces as a 3D scene. Its writing is painted into textures (`SlateColumn.tsx`, about 1,870 lines, uses canvas textures and per-frame loops). `WorldStage.tsx` runs about 10 effects.
- We have not confirmed yet what causes the rigid feel. The likely causes are: textures redrawn on every keystroke, the whole scene updating when one line changes, per-frame work, and saving or marking that runs before the screen updates. Step 1 will check each of these.

## Step 1: Audit (no behavior changes)
1. Record timings on the live Game and on the Smartboard for the same actions: tap a surface, type a symbol, drag a Floating Number, move the sensor, scroll, open or close controls, submit a line.
2. For each action, track the time from input to the next painted frame, how many times parts of the screen redraw, network calls made before the visual change, texture rebuilds, and long tasks.
3. Write the comparison table (Interaction | Smartboard | Game | Cause | Fix) to `docs/game-responsiveness-audit.md`. Then answer your five questions in chat, using the real numbers.

## Step 2: Fixes (only where the audit shows a cause)
- **Screen first, save later:** typing, moving and selecting update the screen on the device right away. Saving, syncing and marking run in the background. If one fails, it retries quietly and never freezes the screen.
- **Isolate each surface:** changing one line redraws only that surface's texture, not the whole Game.
- **Cheaper redraws:** reuse textures, repaint only lines that changed, and at most once per frame. Pause per-frame work when nothing is moving.
- **Pointer handling:** use one set of listeners with no duplicates, keep heavy calculations out of pointer movement, and let a press take effect on pointer-down, as on the Smartboard.
- **Keep the scene mounted:** stop the room and effects from being rebuilt when the game state changes.

## Step 3: Verify like a teacher or student
- Run the same scripted actions again. Target: the screen responds on the next frame (under about 50 ms) with no network wait.
- Rerun all Game tests (marking, rewards, line 0 rules, growth, scrolling) so nothing that works now breaks.

## Not changing
Mathematics logic, marking rules, reward conditions, visuals and artwork, and the Floating Numbers pipeline.
