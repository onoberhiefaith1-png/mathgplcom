# One math layout engine — AI Edit's renderer becomes the display standard

## What I verified in the code

The expression is fine; two different engines paint it.

- The AI Edit panel paints through `renderMathInline` (`src/lib/notebook/mathRender.ts`). Its parser explicitly skips whitespace before a structure and turns spacing macros (`\,` `\;` `\quad`) into a single space, so `a + \sqrt{b}` comes out tight.
- The lesson note paints through the editable tree canvas (`MathInline.tsx` → `MathInlineCanvas.tsx`). `latexToTree` turns **every** whitespace character into a literal character node, and the canvas row renders with `white-space: pre`, so a run of spaces before `\sqrt{...}` survives as visible width. On top of that the canvas radical is an `inline-flex` with its own padding, and empty sub-rows render a 0.6em dashed placeholder box.

So the note is the last surface still running its own layout engine — and it is the one that feeds Present mode.

## The change

Make `renderMathInline` the only thing that ever *displays* mathematics. The tree canvas stays, but only while the teacher is actually inside the object.

```text
create / AI Edit / apply
        ↓
normalizeMathSource      (one shared string standard)
        ↓
layout normalizer        (collapse editing spacing, tighten structures)
        ↓
renderMathInline         (single display engine, everywhere)
        ↓
click in → tree canvas (editing only) → commit → back to renderMathInline
```

### Steps

1. **Display gate** — in `MathInline.tsx`, render the unfocused node through `renderMathInline(normalizeMathSource(value))`. Clicking still opens the canvas at the clicked glyph; blur commits and returns to the rendered form.
2. **Math Layout Normalizer** — a new shared pass run on create, AI Apply, paste, import and every commit: collapse space runs to one, drop spacing entirely adjacent to a structure boundary (before/after radicals, fractions, scripts, brackets, big operators), and strip leftover placeholder/editing artefacts. Applied to the string before it is stored, so the saved value is already tight.
3. **Editing parity** — give the canvas the same font size, baseline and structure metrics as the rendered form, remove the extra radical/fraction side padding, and make an empty slot contribute zero width unless it is the focused slot. Entering and leaving edit mode must not shift the expression.
4. **One engine everywhere** — audit the remaining surfaces (Smartboard, presenter, worksheets, floating panels, student view, export) so they all go through `renderMathInline`; no per-surface spacing overrides. Shared typography values move into CSS variables in `src/styles.css`.
5. **Regression tests** — extend `src/lib/notebook/__tests__/mathParsers.test.ts` with `a + \sqrt{b}`, nested radicals, radical-in-fraction and Σ-with-limits, asserting normalize → serialise stability and that no space survives next to a structure.

## Verification

Re-open the surd note, measure the gap between `+` and `√b` (must be a single normal space, identical to the AI Edit panel), click in and out to confirm nothing shifts, then check the same expression in Present mode and export.

## Scope

Display/layout layer only. No schema change, no change to the math document model, LaTeX serialisation, diagrams, tables or AI Edit behaviour. Existing math nodes improve automatically on next render.

## Files

- `src/components/lessonnotes/extensions/MathInline.tsx` (display gate)
- `src/components/lessonnotes/extensions/MathInlineCanvas.tsx` (metrics + placeholder width)
- new `src/lib/notebook/mathLayoutNormalize.ts` (+ wiring in `mathNormalize.ts`, `aiToNodes.ts`, AI Apply path)
- `src/lib/notebook/mathRender.ts` (token-driven spacing)
- `src/styles.css` (shared math typography tokens)
- `src/lib/notebook/__tests__/mathParsers.test.ts`
