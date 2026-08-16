# Kill the phantom spaces at the source, drop the popup box, and make Apply Changes replace again

## 1. The real cause of the spaces (measured in your open note, not guessed)

I inspected the exact `Recall: log_b (M × N) = log_b M + log_b N` line in your note. The string is byte-identical to what AI Edit renders, so the renderer and the normalizer are innocent. The gap is pure CSS inheritance:

- The lesson-note paragraph carries `text-indent: 20px` (paragraph indent in `src/styles.css`).
- `renderMathInline` builds each script group as an `inline-flex`, which turns its children (`log`, the `sub`) into block-level flex items.
- A block-level box **inherits `text-indent` and applies it to its own first line**. Measured: the `log` glyph is 20.8px wide but its box is 40.75px, and the subscript `b` is 6px wide inside a 26px box — exactly 20px of inherited indent added in front of every piece.

That explains the "10% of the time" pattern: only lines sitting in an indented paragraph show it. The AI Edit panel has no `text-indent`, so it always looks perfect.

**Fix:** reset inherited text metrics on every math subtree, everywhere math is drawn (note body, AI Edit, Present mode, export preview):

```text
[data-math-inline], [data-math-block], .math-inline-display, .math-struct,
and all their descendants:
    text-indent: 0
    text-align: left
    word-spacing: normal
    letter-spacing: normal
```

These are the four properties that leak into blockified flex items; resetting them at the math boundary means no paragraph style can ever reintroduce a gap. A guard test asserts the measured box width of a script group equals its glyph width.

## 2. Delete the popup box under the line

The small dark editing box with the PREVIEW strip goes away completely. Clicking a full-line math object simply puts the caret into the object the same way every other math object works — no popup, no second surface, no raw syntax. The `isSentence` branch and its textarea/preview markup are removed from `MathInline.tsx`.

## 3. Apply Changes replaces the line again

Cause: since a line is now a single object, the AI Edit selection is an inline atom, but `applyAiEdit` still feeds `aiTextToNodes(proposed)`, which returns **block** nodes (paragraph / mathBlock). Inserting block content into an inline position is invalid for the document schema, so the change is silently dropped — nothing appears to happen.

Fix: `applyAiEdit` chooses by target shape.
- Inline target (the selection sits inside one paragraph): replace the range with a single inline `mathInline` node carrying the proposed line (or a plain text node when the line has no mathematics).
- Block target (whole paragraphs selected): keep today's block replacement.
- Replacement is one transaction (`insertContentAt` over the range), then the panel closes and the note is marked dirty so the new line persists.

## Verification before hand-back

- Re-measure the `Recall:` line in the live note: every script group's box width must equal its glyph width (zero indent), and the note line must be visually identical to the AI Edit preview.
- Click the line: caret enters the object, no popup box appears.
- Run AI Edit on that line and press Apply Changes: the note line is replaced by the proposed line, still with no gaps.
- Existing regression tests in `src/lib/notebook/__tests__/mathParsers.test.ts` keep passing.

## Files to change

- `src/styles.css` — math-boundary reset of `text-indent` / `text-align` / `word-spacing` / `letter-spacing`.
- `src/components/lessonnotes/extensions/MathInline.tsx` — remove the sentence popup editor path.
- `src/components/lessonnotes/DocumentEditor.tsx` — inline-vs-block aware `applyAiEdit`.

## Not touched

`renderMathInline`, `normalizeMathSource`, AI Edit itself, Smartboard/Present rendering, exports, tables, diagrams, graphs. No schema or content changes.
