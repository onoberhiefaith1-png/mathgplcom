# Emoji Integrity Across Lesson Notes, Smartboard and Floating Numbers

An emoji is an identity token, like a variable. Once a teacher types it, it must survive every pipeline unchanged: same glyph, same colour, everywhere. Today it breaks in three ways.

## What is wrong now

1. **Broken glyphs (the "?" diamonds).** Every text parser in the maths pipeline walks a string one UTF-16 code unit at a time (`src[i]`, `s[i]`, `s.split("")`). An emoji is two or more code units, so it gets sliced in half and each half renders as the replacement character. Confirmed in `mirrorFromLessonNote.ts`, `mathTreeLatex.ts`, `floatingExtractor.ts` and `unicodeMath.ts`. This is why the Solution line shows `2 ?? +3 ??` and why floating chips show diamonds instead of the squirrel.
2. **Emoji colour changes.** Emoji characters are rendered as ordinary maths characters inside ink-coloured containers, inheriting the ink colour, ink font stack and any ink filters — so a colour emoji flattens to the monochrome ink colour.
3. **Emoji panel scrolls with the note.** The docked panel is a plain flex sibling, so wheel scrolling chains into the lesson-note page and vice versa.

## What will be built

### 1. Grapheme-safe text handling
Add one shared helper (`src/lib/text/graphemes.ts`) that splits a string into user-perceived characters (emoji, skin tones, ZWJ sequences, variation selectors and flags all stay whole), plus an `isEmoji()` test.

Every place that turns text into character nodes or tokens switches to it:
- `mirrorFromLessonNote.ts` — lesson note to smartboard ink
- `mathTreeLatex.ts` — LaTeX/text to maths tree
- `floatingExtractor.ts` — question to floating-number tokens
- `unicodeMath.ts` superscript/subscript mapping (an emoji is never a script character)
- keyboard insertion path in `PresentationView.tsx` / `MathInlineCanvas.tsx`

An emoji becomes exactly one `char` node, never a token to be normalised, never a candidate for operator/variable rewriting, and never dropped by the display gate or chip sanitiser.

### 2. Emoji is an identity token
- Floating-number extraction treats an emoji-bearing term as one atomic term, so `3 🐿️` stays `3 🐿️` on the chip and on the board.
- The display-safety and hygiene passes get an emoji allow-list so emoji are never stripped or replaced by placeholder boxes.
- The "?" replacement character is added to a guard: if any pipeline still emits it, the original text is used instead.

### 3. Emoji colour never changes, size does
Emoji character nodes render inside a dedicated span that:
- opts out of ink colour, ink font and any ink filter/blend
- uses the system colour-emoji font
- keeps `font-size: inherit`, so teacher text-size changes still scale the emoji

Applied in `MathTreeRender.tsx`, `FloatingNumberPanel.tsx` chips, presenter preview and reasoning-panel mirrors, so the emoji looks identical in all four surfaces.

### 4. Independent emoji panel scrolling
`EmojiPanel` becomes a fixed-height column (`h-full`, own scroll container) with scroll-chaining disabled, so the emoji list scrolls on its own and the lesson note keeps its own scrollbar. The category list and the emoji grid each keep their own scroll area.

## Verification
- Type an emoji in a lesson note, present it: identical glyph and colour on the board.
- Generate a solution and open Floating Numbers: the emoji chip shows the emoji, no diamonds.
- Change ink colour and text size on the smartboard: emoji size changes, colour does not.
- Scroll the emoji panel: the note does not move, and vice versa.
