# Keep every Game line inside its own writing surface

## Confirmed problem

The screenshot shows the Floating Numbers entry is reaching the Game, but the visible text and its writing surface are not using one shared box:

- each Play surface calculates its own content-based width and is anchored inside the 5%–95% safe area;
- the text renderer is still given the full screen-wide writing width and is positioned separately from that surface;
- centred or right-aligned saved text can therefore be laid out somewhere other than its physical panel;
- a long teaching note can measure and wrap against the screen-wide area instead of the line’s own panel, placing text beyond the panel and screen;
- the note is already selected only from `completedLines`, but that state must remain tied exclusively to the authoritative correct-mark event.

## Build

### 1. One local writing box per surface

For every Game line, calculate one layout object containing:

- surface position;
- surface width and height;
- inner writable width and height after material insets;
- text origin and alignment.

Render the physical surface and its text inside the same parent position. Remove the separate screen-wide text offset that currently allows them to drift apart.

### 2. Grow from the line’s own rendered content

- Empty lines remain compact.
- Each tap from Floating Numbers immediately updates only its matching line.
- The matching surface grows horizontally with that line’s measured equation.
- Growth stops inside the 5%–95% safe area.
- Beyond that width, text wraps inside the same surface and the surface grows downward.
- Later surfaces move down to preserve their gaps; no surface inherits another line’s dimensions.
- The same calculation will cover dimensional text and tile text.

### 3. Preserve the teacher’s exact text style

Keep the saved font, size, colour, depth, opacity, animation, alignment, spacing, and material treatment. Responsive fitting may constrain the text to the inner writing box, but it will not replace the teacher’s chosen style.

### 4. Reveal notes only after a genuine award

Keep the equation and teaching note as separate display parts within the same surface:

- before the line is awarded, show only the student’s working;
- reveal that line’s note only after the marking service returns a correct/equivalent result and records the line award;
- an incomplete, incorrect, stale, or failed evaluation cannot reveal the note;
- changing lines cannot reveal a note;
- Reset hides notes again with the cleared run state while preserving teacher-authored notes.

### 5. Keep rewards behind the same award truth

Non-Vault line rewards and the completion coin will continue to activate only from that same recorded line award. Vaults remain the sole exception and open only from their own consecutive encrypted mathematical code. A click never activates a reward.

### 6. Remove the stray screen error

Trace and remove the current `v is not defined` runtime error if it occurs in this Game path, without changing unrelated pages or security work.

## Verification before completion

Test the teacher’s current Game, not a substitute example, at phone and desktop sizes:

1. Surface 0 shows the complete question inside its panel.
2. Tap several Floating Numbers rapidly on Lines 1, 2, and 3; every symbol appears immediately on the matching surface.
3. Test left, centre, and right teacher alignment; text remains inside its own surface.
4. Test dimensional and tile text styles; both remain inside their surfaces.
5. Enter a long equation; its surface grows to the safe width, then wraps and grows downward.
6. Use a long note; it stays hidden before marking and wraps inside the awarded line’s surface afterward.
7. Submit an incorrect and a mathematically non-equivalent expression; no mark, note, completion coin, or line reward appears.
8. Submit a valid equivalent expression; the mark is awarded once, then the note and eligible rewards activate once.
9. Jump between lines; text, notes, marks, and rewards never leak into another line.
10. Reset; working, awards, revealed notes, and consumed rewards clear, while the saved Game design and teacher text settings remain unchanged.
11. Scroll from the first to the last surface on a phone; all content remains reachable and inside the 5%–95% boundaries.
12. Confirm no blank text, off-screen text, overlap, frozen input, or Game runtime error remains.

## Not changing

No Slate Artisan redesign, new mathematics engine, reward redesign, editor workflow change, security change, or replacement Floating Numbers interface.
