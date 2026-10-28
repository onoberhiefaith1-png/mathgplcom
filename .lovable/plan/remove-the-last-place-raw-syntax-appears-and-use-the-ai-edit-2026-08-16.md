# Remove the last place raw syntax appears, and use the AI Edit renderer everywhere

Verified in the code: display in the note already goes through the AI Edit engine. `MathInline` paints every unfocused expression with `renderMathInline(normalizeMathSource(value))` — the same call the AI Edit preview uses. So display parity is in place.

The remaining defect is the **editing** surface, which is exactly what your second screenshot shows.

## 1. Raw syntax on click (the boxed `log_2 (2 × y × z)`)

`src/components/lessonnotes/extensions/MathBlock.tsx` still opens a monospace, code-style field containing the raw source (`latexToFriendly(value)` in a `font-mono` contentEditable). Clicking a solution line therefore shows `log_2 (...)` — raw, code-like notation, in a bordered box.

Fix: the block line stops having a source field.
- Clicking a `mathBlock` line opens the same structural math canvas the inline objects use (`MathInlineCanvas`), where subscripts, fractions and radicals are real regions and the caret moves between them. Nothing is ever displayed as `_`, `^`, `\frac` or backslash text.
- Commit path unchanged in spirit: tree to source through `normalizeMathSource`, so the stored value stays tight and canonical.
- The monospace field, `font-mono` styling and `friendlyToLatex` round trip in that node view are deleted.

After this change there is no surface left in the note that renders math as text: display is `renderMathInline`, editing is the structural canvas.

## 2. Enforce "zero raw syntax" instead of hoping for it

A document-wide guard runs after load, after AI generation, and after Apply Changes: any text node still containing `\macro`, `^{`, `_{`, `sqrt(`, `**` or `$` is converted into a math object rendered by `renderMathInline`. Raw markup can no longer survive to the screen from any entry point (AI, paste, import, legacy notes).

## 3. Spacing and the run-together solution lines

In your first screenshot two solution steps sit on one line (`log₂2 + log₂y + log₂z log₂(2 × y × z)`), and one line carries a stray indent. That is line construction, not the renderer: the AI solution rows are being merged when a row has no explicit break. I will make each solution step its own line object and remove the inherited paragraph indent for solution rows, so the steps stack one micro-step per line as the pedagogical standard requires.

Spacing inside an expression comes only from `renderMathInline` plus `normalizeMathSource`; no global space stripping is added.

## Verification before hand-back

- Click the `log₂(2 × y × z)` solution line in your open note: the structural editor opens, no monospace box, no `log_2` text anywhere.
- Sweep every text node of that note plus a freshly generated note for `\`, `^{`, `_{`, `$`: must be zero.
- The Exercise 2 solution renders as separate stacked steps, each visually identical to its AI Edit preview.
- Existing tests in `src/lib/notebook/__tests__/mathParsers.test.ts` still pass, extended with a case asserting a block line never yields raw source for editing.

## Files to change

- `src/components/lessonnotes/extensions/MathBlock.tsx` — structural editing, source field removed.
- `src/components/lessonnotes/DocumentEditor.tsx` — post-load / post-AI / post-Apply raw-syntax guard.
- `src/lib/lessonnotes/aiToNodes.ts` — one solution step per line; no merged steps.
- `src/styles.css` — only the solution-row indent, if needed.

## Not touched

AI Edit itself, `renderMathInline`, `normalizeMathSource`, Smartboard/Present rendering, exports, tables, diagrams, graphs. No schema change and no lesson-note content change — only re-grouping and re-rendering.
