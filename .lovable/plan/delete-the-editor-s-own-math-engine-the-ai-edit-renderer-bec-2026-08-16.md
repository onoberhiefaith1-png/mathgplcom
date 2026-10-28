# Delete the editor's own math engine — the AI Edit renderer becomes the only one

You are right: AI Edit is never wrong, because AI Edit hands the **whole line** to one renderer in a single call. The note editor does not — it still cuts the line into many small pieces (`log`, `_b`, `A`, `+`, prose text …) and each piece becomes its own object. Every visible gap in your screenshot is a seam between those pieces, not something the renderer produced. That splitter is the code to remove.

## What gets deleted

- The line splitter in `src/lib/lessonnotes/aiToNodes.ts` (`tokenizeMathLine`, `scanTokens`, span growth, math-glue heuristics). Gone entirely.
- The editor-only display path in the math node (tree canvas used for *display*). It stops being a display engine.

## What replaces it

One rule, the AI Edit rule:

```text
line of text
   ↓
sanitizePresentation → assertDisplaySafe → normalizeMathSource
   ↓
does the line contain mathematics?
   no  → plain prose paragraph (unchanged)
   yes → ONE math object for the whole line, drawn by a single
         renderMathInline() call = byte-for-byte the AI Edit preview
```

- No more than one math object per line. No prose/math seams inside an expression, so no phantom spaces.
- Same function, same normalizer, same options AI Edit uses — no editor-specific spacing, fonts or padding anywhere.
- Applies to every entry point: AI generation, Apply from AI Edit, paste, import, and existing notes (the repair pass re-groups any old fragmented line into the single full-line object when the note opens; your current logarithm line fixes itself).

## Raw syntax can never appear

This is enforced, not hoped for:

1. Every value passes the display gate before it reaches the DOM; a value that still contains raw markup after gating is rendered through `renderMathInline` anyway (which converts `\frac`, `\sqrt`, `^{`, `_{` into real stacked structure) and never printed as text.
2. Editing a math object never shows LaTeX inside the note. Clicking one opens a small inline editor: the note keeps showing the rendered form, and the source is typed in a separate field with a live rendered preview — exactly how AI Edit behaves. On commit, the note re-renders through the same single call.
3. Automated check over the whole document after every AI apply: if any text node still contains `\macro`, `^{`, `_{`, `sqrt(`, `**` or `$`, that line is re-materialised as a math object instead of being displayed.

## Verification before I hand it back

- The exact line from your screenshot (`For example, if we have log_b A + log_b B, we combine it into log_b(A × B).`) rendered in the note and in the AI Edit preview must be identical — one object, no gaps around `log_b`.
- Sweep the open note plus a generated note for residual raw syntax in any text node; must be zero.
- Regression tests extended in `src/lib/notebook/__tests__/mathParsers.test.ts`: one math run per line, no split words, no raw macro left in prose.

## Technical notes

- `src/lib/lessonnotes/aiToNodes.ts`: splitter removed; `lineToNodes` becomes "prose paragraph" or "single full-line math node"; `repairDocumentMath` re-groups legacy fragmented paragraphs.
- `src/components/lessonnotes/extensions/MathInline.tsx` / `MathBlock.tsx`: display is always `renderMathInline(normalizeMathSource(value))`; the tree canvas is no longer used for display.
- Untouched: AI Edit itself, `renderMathInline`, Smartboard/Present rendering, exports, tables, diagrams, graphs. No schema change, no content rewrite — only re-grouping.
