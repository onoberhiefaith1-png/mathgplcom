## What you are seeing

In your screenshot the two squares under `x =` have **sharp, solid, ink-dark outlines**. The smartboard's real placeholder slot (`SmartboardPlaceholderSlot`) is drawn *dashed* and painted in the placeholder colour (cream `#efece5`, i.e. board colour) — it cannot look like that. So the squares on screen are almost certainly **not** the placeholder component: they are drawn by some other path (a literal `□` character rendered as ordinary ink text, or a bordered `box` node), which is exactly why:

- the Placeholder Colour setting has no effect on them (that setting only feeds `SmartboardPlaceholderSlot`), and
- they do not vanish when you type (a real character/box is not a slot — typing lands beside or inside it).

I could not reproduce it in the headless browser this turn (the board loaded, but the Structures palette did not open under automation), so this diagnosis is **strongly indicated but not yet confirmed**. Step 1 confirms it before anything is changed.

## Plan

### 1. Confirm the exact culprit (no code changes)
Reproduce on the live board: place the caret, insert a fraction / drop a chip, then read the DOM for those two squares — check whether they carry `data-sb-placeholder`, and read their computed `border-style`, `border-color` and text content. Three possible outcomes:
- text content is `□` → a char node is being rendered as ink text;
- a `box` node is drawing its own outline;
- it *is* the placeholder slot but the resolved colour/style is being overridden.

The rest of the plan handles all three, so no rework either way.

### 2. One placeholder authority
Make `SmartboardPlaceholderSlot` (fed by `placeholderColor`) the **only** thing that can ever draw an empty slot on the board:
- In `MathTreeRender.tsx`, a `char` node whose character is `□` renders as a placeholder slot, never as ink text.
- No `box`/structure node draws its own outline; the empty child row owns the single slot.
- Same rule in `mathRender.ts` (`emptySlotBox`) so mirrored lesson-note math matches.

### 3. Real placeholder behaviour
- A `□` char node behaves as an empty slot: clicking it puts the caret **in** it, and the first typed character **replaces** it (the slot disappears), matching normal placeholder behaviour.
- Ingestion (`mirrorFromLessonNote.latexToRow`, floating chip payloads such as `□/□`, `√□`, `□^{□}`) converts every `□` into an empty structure row up front, so `□` never survives as content on the board.

### 4. Make the colour setting actually apply
- Verify `placeholderColor` is threaded to every renderer on the writing surface (free-write layer, beat blocks, box layer, floating panel, presenter preview) — any renderer left on the hard-coded constant ignores the setting.
- Default "Board" resolves to the board surface colour so the slot blends invisibly, with only the dashed hairline visible on close inspection; the active slot still shows the caret glow so the teacher knows where they are.

### 5. Lock it with tests
Regression tests asserting: (a) a row containing `□` renders zero ink `□` glyphs and exactly one placeholder element; (b) typing into an empty slot removes the placeholder element; (c) an inserted fraction produces exactly two placeholders (never a placeholder nested inside another). This is the guard that stops the issue coming back.

## Technical notes
Files in scope: `src/components/smartboard/MathTreeRender.tsx`, `src/components/smartboard/SmartboardPlaceholderSlot.tsx`, `src/lib/smartboard/placeholderColor.ts`, `src/lib/smartboard/mirrorFromLessonNote.ts`, `src/lib/smartboard/mathTree.ts` (insert/backspace over a `□` slot), `src/lib/notebook/mathRender.ts`, plus a new test file. No backend or schema changes.
