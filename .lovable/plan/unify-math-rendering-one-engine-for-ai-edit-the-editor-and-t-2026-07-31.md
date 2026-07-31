# Unify math rendering: one engine for AI Edit, the editor, and the Smartboard

## What is actually happening

Your diagnosis is right that there are two pipelines, but AI Edit is not doing AI parsing, normalization or symbol correction. Confirmed by reading the code:

- AI Edit's preview calls `sanitizePresentation(text)` and then `renderMathInline(text)` from `src/lib/notebook/mathRender.ts`. That is the full classroom renderer: `\frac`, `\sqrt`, `^{}`/`_{}`, `\sum`/`\prod`/`\int`/`\lim` with stacked limits, accents (`\bar`, `\vec`, `\hat`), `\binom`, matrices, absolute-value/norm fences, operator spacing.
- The editable math object in the lesson note (`MathInline` -> `MathInlineCanvas`) does **not** use that renderer. It parses the stored LaTeX with `latexToTree()` in `src/lib/smartboard/mathTreeLatex.ts`, which only understands `\frac`, `\sqrt`, `\sqrt[n]`, `^{...}`, `_{...}`. Everything else is pushed through as literal characters.

That is exactly your screenshot: `\sum | x _i - \bar{x}|` is rendered as raw text inside the fraction, because `\sum` and `\bar{}` are unknown to the tree parser, while AI Edit shows the correct Σ|xᵢ − x̄| form.

Second, related defect: `treeToLatex()` only serializes char/frac/sqrt/subsup/power/bracket. The tree model already supports `bigop`, `accent`, `binom`, `matrix`, but those kinds fall through to "emit children", which silently deletes the operator on save. So even a correct structure would be destroyed on the next write.

Third, Apply: `applyAiEdit` -> `aiTextToNodes(proposed)` creates `mathInline` nodes carrying the LaTeX string, which then goes straight back through the same limited `latexToTree` -> raw text again. Nothing is wrong with Apply itself; it hands correct LaTeX to a parser that cannot represent it.

## Goal

Make the editable/Smartboard path structurally capable of everything `renderMathInline` can display, and never let unrepresentable markup reach the screen as raw text.

## Plan

1. **Extend the shared parser** (`mathTreeLatex.ts` -> `latexToTree`)
   Add support for the constructs the renderer already handles: `\sum \prod \int \oint \lim` with `_{}`/`^{}` limits (-> `bigop`), `\bar \vec \hat \overline \tilde` (-> `accent`), `\binom`, `\left…\right` and `|…|` / `\abs` / `\norm` fences (-> `bracket`), `\begin{pmatrix|bmatrix|matrix}` (-> `matrix`), plus the LaTeX-name-to-unicode symbol table already used by `mathRender` (`\times`, `\pm`, `\le`, `\alpha`, …) so those become single char nodes instead of backslash text.

2. **Make serialization lossless** (`treeToLatex`)
   Add the missing cases for `bigop`, `accent`, `binom`, `matrix`, `box` so a parse -> edit -> save round trip preserves structure. Extend `src/lib/notebook/__tests__/mathParsers.test.ts` with round-trip cases for each new construct, including the mean-deviation formula from your screenshot.

3. **Single normalization entry point**
   Add one helper (e.g. `normalizeMathSource`) that both surfaces call before display: `sanitizePresentation` -> `latexToFriendly` -> brace balancing. AI Edit preview, `MathInline`'s `parseTree`, and `aiTextToNodes` all use it, so the same input string produces the same structure everywhere.

4. **Safety gate so raw LaTeX can never be displayed**
   Reuse the existing `assertParseRoundTrip` check in `MathInline`: if the parse is lossy (round trip does not match), the node renders read-only through `renderMathInline` — the exact AI Edit output — instead of showing backslash text. Clicking it still opens the canvas for editing. This guarantees that even a construct we have not covered yet displays correctly rather than leaking markup, and it makes the "AI Edit as validation layer" rule real without adding a network call to rendering.

5. **Apply parity**
   With steps 1-4 in place, `applyAiEdit` produces nodes whose displayed form is identical to the AI Edit preview. Verify visually on the mean-deviation formula: preview before Apply and the note after Apply must match pixel-for-pixel in structure.

## Backward compatibility

- No schema change, no new node types, no editor redesign. Existing `mathInline` nodes keep their `value` LaTeX; stored `tree` JSON is still honoured first.
- Existing documents improve automatically because the value string reparses with the extended grammar; nothing needs re-creating.
- 2D/3D diagrams, tables, Smartboard behaviour and AI Edit behaviour are untouched — only the LaTeX-to-tree/tree-to-LaTeX layer and the display gate change.

## Files to change

- `src/lib/smartboard/mathTreeLatex.ts` (parser + serializer)
- `src/lib/notebook/mathFriendly.ts` or a small new `src/lib/notebook/mathNormalize.ts` (shared normalize entry)
- `src/components/lessonnotes/extensions/MathInline.tsx` (normalize + fallback-to-`renderMathInline` gate)
- `src/lib/lessonnotes/aiToNodes.ts` (use the shared normalizer)
- `src/components/lessonnotes/DocumentEditor.tsx` (preview uses the same normalizer)
- `src/lib/notebook/__tests__/mathParsers.test.ts` (round-trip coverage)
