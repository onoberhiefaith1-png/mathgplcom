# Make the sensor work in the Game, exactly as it works on the Smartboard

## What is wrong

On the Smartboard the sensor (the writing cursor) can be walked into a bracket, a fraction or an exponent, so typing `x+3` after tapping `2( )` gives `2(x + 3)`.

In the Game that same board is running underneath — the Game already uses the Smartboard's mathematics and its sensor. But when a Game is open, everything of the Smartboard except the Floating Numbers strip is hidden from sight and from touch, and the sensor controller (the small ◀ ▲ ▼ ▶ pad) is switched off on purpose. So there is no way to move the sensor inside a bracket or an exponent: every tapped value lands after the bracket, which is why the line reads `2()x+3` instead of `2(x+3)`.

Nothing about the mathematics is broken. The sensor control is simply missing from the Game.

## The fix

1. Bring the Smartboard's existing sensor pad into the Game, unchanged. ◀ and ▶ do in the Game exactly what they do on the Smartboard: step the sensor character by character through the line, entering an empty bracket, a fraction slot or an exponent, and stepping back out again. No new cursor logic is written — the Smartboard's own movement is reused.

2. Keep line navigation as it is. Game Lines still own which line is active, so the pad's up/down stay switched off in the Game and the existing Game Line controls keep that job.

3. Show the sensor on the writing surface. The Game surface currently mirrors the line as plain text, so the student cannot see where the next character will land. The active line's mirror gains a thin sensor mark at the sensor position, and an empty slot inside a bracket, fraction or exponent shows as a small placeholder box — the same reading as on the Smartboard.

4. Place the pad clear of the Floating Numbers strip and the Game HUD, and keep it reachable on a phone.

## Acceptance test

Question `2(x + 3) − 4x = 8`. On line 1: tap the `2( )` value, press ▶ once to enter the bracket, tap `x+3` — the line reads `2(x + 3)`, with the sensor visible inside the bracket. Press ▶ again to leave the bracket and keep writing after it. Repeat with an exponent slot. Marking, rewards, vault, timers and sounds behave as before.

## Technical notes

- `PresentationView.tsx` mounts `SensorDPad` behind `!gameChrome`; the Game-chrome style block also hides `[data-sb-sensor-dpad]`. Both exclusions are lifted for horizontal movement only, so `nudgeCursorHoriz` (which already delegates to `treeMoveLeft` / `treeMoveRight` over the row tree) becomes reachable in the Game.
- The sensor mark and placeholder box come from the same per-line mirror that already feeds the Game surfaces (`onLineText` → `mirrorLineText`), so there is one text source and one cursor authority.
- No change to the mathematics tree, grading, predictive evaluation, rewards, Vault, timers, sounds, Game Slate, rooms or saved stage design.
