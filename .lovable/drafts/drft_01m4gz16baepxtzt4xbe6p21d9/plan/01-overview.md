# Game: instant marking back, sensor always visible, sensor inside placeholders

Game only. Smartboard, Academia, Floating Numbers rules and reward maths stay as they are.

## 1. Instant marking again (first)
- Reproduce it in a signed-in Game: write a correct line and check whether the mark lands on the last piece or only after moving to the next line.
- Find what changed. The recent sensor and strip changes in this draft are the main suspects (the new sensor events and the auto-entry of placeholders run on the same writing update that triggers the instant award). The cause is not confirmed yet; the first step is to prove it.
- Restore the rule: the moment the Predictive Line's final red piece is placed and the line is equivalent, the line is marked and rewarded on that same press. Moving to the next line is never needed.
- Add a test that fails if marking ever waits for a line change again.

## 2. Sensor always visible from the start
- As soon as the writing surfaces appear, the sensor blinks on Line 1, before anything is typed.
- It stays visible while writing, pausing, scrolling and after marking.
- Clicking or tapping any writing surface moves the sensor there. Surface 0 (the question, Q) never takes it.

## 3. Sensor inside placeholders
- When a placeholder opens (bracket, exponent, fraction), the sensor goes straight inside it, so the next piece lands there and can be removed with Backspace.
- Moving down to a denominator (arrow key, on-screen arrow, or tap) puts the sensor inside the denominator placeholder; up returns to the numerator.
- Mouse, keyboard arrows and tapping all move the same single sensor.
