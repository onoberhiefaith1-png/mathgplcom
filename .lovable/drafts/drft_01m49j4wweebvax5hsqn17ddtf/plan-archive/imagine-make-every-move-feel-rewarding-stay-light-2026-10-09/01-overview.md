# Imagine — make every move feel rewarding, stay light

Rule one: nothing below may make Imagine heavy. All sounds are generated in the browser (no downloads), all effects are flat CSS on their own layer, and none of them can delay typing or marking.

## 1. One continuous margin line
- Replace the per-surface margin marks with one long line running down the whole writing column, like the Game.
- Drag it left/right (phone, tablet, desktop); every line's text starts just after it and never goes past the surface edge.
- Line numbers sit left of the line, small; number + line together stay at most 5% of screen width on phone.

## 2. Text and notes
- Notes use the same size as the main writing.
- Text-size slider goes down to a much smaller minimum (0.15) so long equations always fit.

## 3. Moving around the board
- Tap a line, or use arrow keys, to move the writing sensor to lines 1 and above. Line 0 stays locked.

## 4. A sound for every move ("Royal Match" feel)
Short, soft, free sounds — no text pop-ups:
- typing a digit/symbol: light tick (slight pitch variation so it never sounds robotic)
- erase / undo / redo: soft swipe
- pressing #, moving to a new line: gentle step chime
- line marked correct: bright rising chime; streak of correct lines climbs in pitch
- line wrong: soft low thud (never harsh)
- reward activates: its own existing sound
- question complete: short celebration flourish

Respects the existing sound on/off and volume. Rapid typing is throttled so sounds never pile up.

## 5. Rewards that do something
- **Vault**: reveal, then the treasure flies out and disappears.
- **Bomb**: can set off nearby bombs in a short chain.
- **Time / Life**: collected time and lives convert into score at the end.

All visual effects run on the separate reward layer and never block the board.
