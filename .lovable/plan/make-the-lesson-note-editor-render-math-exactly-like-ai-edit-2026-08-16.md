# Make the lesson-note editor render math exactly like AI Edit

## What is actually wrong (verified in the code)

AI Edit renders the whole expression with **one** call to `renderMathInline`, so the renderer controls every gap. The normal editor does not: `tokenizeMathLine` in `src/lib/lessonnotes/aiToNodes.ts` chops a line into many small runs, and each math run becomes a separate inline atom node. The gaps a teacher sees are the seams between those atoms and the surrounding prose text — not something the math renderer produced.

Actual tokenizer output today for the exact case in the screenshots:

```text
"log_2(M × N) = log_2 M + log_2 N"
  text "lo"  |  math "g_2"  |  text "(M × N) = lo"  |  math "g_2"  |  text " M + lo"  |  math "g_2"  |  text " N"
```

Two defects visible there:

1. The word `log` is cut in half — `lo` stays prose text and only `g_2` becomes math, because the subscript rule fires on the preceding single character.
2. Everything else in the expression (`(M × N)`, `=`, `+`, the operands) stays **prose text** in the paragraph font, so its spacing is browser word-spacing, not mathematical spacing.

Same pattern with proper LaTeX input: `\log_{2}` renders as math while `(MN) = `, `M + `, `N` stay prose.

## The fix: one math run per expression, rendered by one engine

1. **Maximal math spans.** Replace the character-by-character run splitter with a segmenter that finds the *whole* mathematical expression as a single run: function names (`log`, `ln`, `sin`, `cos`, `tan`, `lim`, …) are read as complete words, and a math run is grown outward across adjacent operands, operators (`= + − × ÷ · ^ _ < > ≤ ≥ ≠ ≈ →`), digits, single-letter variables, brackets and structures, stopping only at real prose words. A word is never split.
2. **One node per expression.** That whole span becomes one `mathInline` node, so `log₂(M × N) = log₂M + log₂N` is a single object drawn by `renderMathInline` — pixel-identical to the AI Edit preview. Lines that are entirely mathematical continue to become one `mathBlock`, as now.
3. **Prose stays prose.** Sentence text outside the span is untouched; nothing is passed through the math renderer that is not mathematics.
4. **No global space-stripping.** Spacing comes only from the renderer plus the existing `normalizeMathSource` / `normalizeMathLayout` pass, which already runs on every value that is stored or displayed.
5. **Zero raw syntax.** The existing display gate keeps its job, and the repair pass (`repairDocumentMath`) is extended so a paragraph whose text still contains half-split math (`lo` + `g_2`, loose `_{`/`^{`, stray `\log`, unmatched delimiters) is re-segmented with the new rules. Existing notes therefore fix themselves on open — content is never rewritten, only re-grouped into math objects.
6. **Everything that generates or edits math uses this same path**: AI generation (`aiTextToNodes`, `aiTextToSolutionRows`), Apply from AI Edit, paste, and the repair migration.

## Verification

Round-trip tests in `src/lib/notebook/__tests__/mathParsers.test.ts` extended with the log case above and mixed prose+math sentences, asserting: one math run per expression, no split words, no residual `_{`/`^{`/`\macro` in any text run. Then a visual check in the editor: AI Edit preview of the log identity and the applied result in the note must match.

## Files to change

- `src/lib/lessonnotes/aiToNodes.ts` — new segmenter, span growth, function-name awareness, extended `needsRepair`.
- `src/lib/notebook/__tests__/mathParsers.test.ts` — coverage for the cases above.
- `src/styles.css` — only if a seam remains between an inline math object and adjacent prose after the segmenter lands (kerning of `[data-math-inline]`); no new math metrics.

## Not touched

AI Edit itself, `renderMathInline`, `normalizeMathSource`, Smartboard/Present rendering, exports, tables, diagrams and graphs. No schema change, no lesson-note content change.
