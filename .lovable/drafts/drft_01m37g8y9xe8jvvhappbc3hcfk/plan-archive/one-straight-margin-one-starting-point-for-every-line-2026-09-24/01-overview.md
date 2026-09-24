# One straight margin, one starting point for every line

## What is wrong now

Each line still keeps its own saved sideways position. The margin only shifts the
whole writing block, so the saved positions win and lines end up at different
starting points — one too far right, one sitting on the wrong side of the line.
The margin is also drawn relative to the panel, so it can look as if it belongs
to the scroll's curved edge instead of being one straight reference line.

## What you will get

- **One straight vertical margin** per writing surface: perfectly upright, running
  from the top of the writing area downward, at one single position. It ignores
  the scroll's rolled and curved decoration completely.
- **Every line starts at that margin** — the question (Line 0), every working
  line, the answer, notes and labels. No line has its own private starting point
  any more.
- **Nothing can sit at or before the margin.** Writing always begins just after
  it, by the surface's normal padding. A line can be indented further to the
  right on purpose, but never pulled back past the margin.
- **Line tags stay put.** Line 0, Line 1, Line 2 … are part of the surface design
  in a fixed strip at the very beginning of the scroll. They are created, moved
  and removed with their line, and moving the margin never moves them.
- **Existing lines are normalised.** All the old hand-nudged positions are dropped
  and every line snaps to the one margin.
- **No trembling.** One calculation decides the position once and it stays; the
  repeated self-correction that caused the shaking is removed.
- **Surface behaviour unchanged.** The left edge of the scroll never moves, and the
  right edge still grows only when the writing genuinely needs the room and
  shrinks back when it does not.
