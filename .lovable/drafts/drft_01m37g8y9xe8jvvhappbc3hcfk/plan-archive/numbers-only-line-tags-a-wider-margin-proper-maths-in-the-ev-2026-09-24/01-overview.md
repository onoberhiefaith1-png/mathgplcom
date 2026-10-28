# Numbers-only line tags, a wider margin, proper maths in the evaluation panel, and instant rewards

## 1. Line tags show only the number
- The tag at the start of each writing surface changes from "Line 0, Line 1, Line 2 …" to just "0, 1, 2, 3 …".
- The strip saved for the tag gets narrower (one or two digits wide), so the writing has more room.
- The margin line can then move further left, closer to the edge of the surface. Its lower limit sits just after the number, so writing still can't overlap the tag.
- Everything else stays the same: one straight margin, a one-letter gap, and a fixed left edge.

## 2. No raw maths code in the Game Evaluation panel
- At the moment, "Expected line" shows code like `\frac{-2x}{-2} = \frac{2}{-2}`, and "Student line" shows `(□)/(□)`.
- Both will show as proper written maths: stacked fractions, real minus signs, and empty boxes where the student hasn't finished yet. They'll use the same maths display as the rest of the platform.
- If some text can't be read as maths, it will show as plain readable text, never as raw code.

## 3. Rewards fire the moment a line is equivalent
- **The problem:** the panel shows "Equivalent" straight away, but the coin, the mark, the note and the line's rewards only arrive once you move to the next line.
- **Where the delay comes from (checked in the code):** the panel works out "Equivalent" on the Game page itself. The rewards, though, only listen to the board's award signal. In Test Play, the board's instant award is turned off, because it only runs for students in an assignment. So the award only arrives through the "line changed" message, which is sent when you move to another line.
- **The fix:** the same check that shows "Equivalent" will now pay the line straight away, in the same moment. That covers the mark, the completion coin, all the line's rewards, the note and the sound. You don't need to move to the next line.
- Safety rules stay: a line is only paid once. A wrong line never pays. The board's own check can still confirm the result afterwards, but it will never pay a second time.
