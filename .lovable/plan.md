## What's wrong

The floating-number chip `x = □/□` renders **four** placeholder boxes: a stacked fraction with two empty cells, plus two loose boxes floating beside it. The generating page is correct — the damage happens while the chip text is normalised.

## Confirmed cause

The chip text starts life as `x=\frac{□}{□}` (the fraction shell markup in `src/lib/smartboard/floatingExtractor.ts`, `STRUCTURE_MARKUP.fraction`).

It then passes through `toUnicodeMath` (`src/lib/notebook/unicodeMath.ts`, duplicated at `supabase/functions/notebook-ai/unicodeMath.ts`), which near the end runs a blanket "strip stray braces" pass:

```text
s = s.replace(/[{}]/g, "");     →   "x=\frac□□"
```

The braces that belonged to the fraction are deleted, so `\frac` loses its two arguments and the two `□` become orphan characters.

The renderer then does the honest thing with broken input: in `src/lib/notebook/mathRender.ts` the "unbalanced `\frac`" fallback emits an empty fraction with **two** placeholder slots and skips past `\frac`; the two leftover `□` characters are then each rendered as their own placeholder slot. Total: 4 boxes — exactly what the screenshot shows.

## The fix

1. **Protect structural macros before the brace strip** (`src/lib/notebook/unicodeMath.ts`)
   - Before any brace removal, replace complete `\frac{...}{...}`, `\dfrac`, `\tfrac`, `\sqrt{...}` (and `\sqrt[n]{...}`) groups with pure private-use sentinels, using the same sentinel technique already in the file for power slots.
   - Run the existing cleanup passes.
   - Restore the sentinels verbatim afterwards, so `\frac{□}{□}` survives intact and reaches the renderer whole.
   - Keep the existing `\frac` (no braces) → `□/□` rule for genuinely argument-less macros.

2. **Mirror the same change in the server copy** `supabase/functions/notebook-ai/unicodeMath.ts` so chips generated backend-side are identical to client-side ones.

3. **Defensive renderer guard** (`src/lib/notebook/mathRender.ts`)
   - In the unbalanced-`\frac` fallback, if the characters immediately after `\frac` are `□` `□` (optionally spaced), consume them as the numerator and denominator instead of leaving them as extra loose slots. This guarantees exactly two cells even if some other path damages a fraction in the future.

4. **Regression test** (`src/test/floatingChipPlaceholders.test.tsx`)
   - `toUnicodeMath("x=\\frac{□}{□}")` still contains a well-formed `\frac{□}{□}`.
   - Rendering that chip via the presenter renderer produces exactly **2** `[data-sb-placeholder]` nodes, never 4.
   - Same assertion for `\sqrt{□}` (1 slot) so the brace protection doesn't regress radicals.

## Scope

Rendering/normalisation only. No change to how chips are generated, to the floating-number pipeline, the grader, or the SmartBoard math tree.
