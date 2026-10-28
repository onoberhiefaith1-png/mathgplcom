# Put the sensor anywhere — including inside a solution line

## What is blocking you

A solution line is currently one single math object for the whole line. That object is an atom: the sensor can land before it or after it, but never *inside* it. So on

```text
log₂ (4 × x × y) (Apply the product rule for logarithms)
```

you cannot click between `log₂ (4 × x × y)` and the bracketed comment, and you cannot type a word into the middle. That whole-line object was introduced to kill the spacing gaps; the gaps are now fixed at the CSS level instead, so the line no longer has to be one atom.

## The change

1. **Prose is real text again, mathematics is an object.** A line becomes: prose text runs (fully caret-addressable, sensor moves character by character) plus one object per *complete* mathematical expression. Expressions are grown as whole units — function names (`log`, `ln`, `sin`, `lim`) are never cut, so `log₂(4xy)` stays one object and no word is split.
2. **The sensor can enter a math object.** Clicking inside one places the caret at exactly the clicked spot inside the structure (base, subscript, bracket contents). Arrow keys walk in and out: at the left/right edge of an object the sensor steps out into the surrounding prose, so nothing is a dead end.
3. **Insertion points around every object.** The sensor marker offers a landing position immediately before and after each math object on a line, so you can type "Apply the product rule" next to an expression without touching the expression itself.
4. **Split the two fused lines visible in your note.**
   - Question text glued to mathematics (`… into a single logarithm:log₂ 4 + log₂ x + log₂ y`) splits at the colon: prose line, then the expression on its own line.
   - A trailing bracketed comment (`(Apply the product rule for logarithms)`) becomes its own explanation element rather than being absorbed into the expression, so it is editable as ordinary words.
5. **Still zero raw syntax.** Everything visible remains rendered by the same `renderMathInline` call AI Edit uses; editing an object stays structural (no LaTeX field). Only the *granularity* changes — line objects become expression objects.

## Verification before hand-back

- On the `log₂ (4 × x × y) (Apply the product rule for logarithms)` line: click between the expression and the comment — the sensor lands there; type a word, it appears as prose.
- Click on the subscript `2` — the caret lands inside the subscript; ArrowRight walks out into the rest of the line.
- Re-measure the `Recall:`-style lines: no re-appearance of the 20px gaps (CSS reset stays).
- Sensor movement through Introduction / Explanation lines behaves exactly as it does today.

## Technical notes

- `src/lib/lessonnotes/aiToNodes.ts` — reinstate expression-level segmentation (function-word aware, no word splitting) in place of the one-object-per-line rule; add the colon split and the trailing-comment split; extend the repair pass so existing over-merged lines re-segment on open (your current note fixes itself).
- `src/components/lessonnotes/extensions/MathInline.tsx` — arrow-key edge behaviour: stepping left/right out of the canvas returns the caret to the adjacent prose position.
- `src/components/lessonnotes/DocumentEditor.tsx` — sensor placement accepts positions adjacent to inline math objects.
- Untouched: AI Edit, `renderMathInline`, `normalizeMathSource`, the CSS math reset, Smartboard/Present rendering, exports, tables, diagrams, graphs. No schema change; note content is only re-grouped, never rewritten.
