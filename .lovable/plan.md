## What is actually wrong

The lesson note stores the formula correctly. Reading the notebook record for this lesson, the paragraph contains a proper inline-math node whose value is `\frac{-b ± \sqrt{b^{2} − 4ac}}{2a}`. So the AI output, the server-side validator and the display gate all behaved.

The failure happens when that stored value is **parsed for display** by the inline math editor. Three brace/paren matchers return the index **of** the closing brace, while every call site that uses them assumes the index **after** it:

- `src/lib/smartboard/mathTreeLatex.ts` → `matchBrace` (used by the inline math node)
- `src/lib/notebook/mathFriendly.ts` → `matchBrace` and `matchParen`

A sibling parser, `src/lib/smartboard/mirrorFromLessonNote.ts`, already returns `j + 1` and is explicitly commented "returns index AFTER the closing brace" — it is the correct version. The other two were never aligned with it.

The consequences match the screenshot exactly:

```text
\frac{A}{B}   →  the check "is the next char '{'" tests '}' instead, so \frac
                 is never recognised and prints as literal text
\sqrt{b^{2} − 4ac}  →  the radicand slice drops its last character  → "4a"
^{2}          →  the exponent slice drops its only character        → empty box
```

This is a rendering bug, not a content bug, so no note has to be regenerated — existing notebooks will display correctly as soon as the parser is fixed.

## Fix

1. **`src/lib/smartboard/mathTreeLatex.ts`** — change `matchBrace` to return `j + 1` (index after the closing brace) and document it, matching `mirrorFromLessonNote.ts`. All five call sites in the file (`\frac`, `\sqrt[n]{}`, `\sqrt{}`, `^{}`, `_{}`) already assume the "after" convention, so no other edit is needed there.

2. **`src/lib/notebook/mathFriendly.ts`** — same one-line correction for `matchBrace`, and for `matchParen` (its `(a)/(b) → \frac{a}{b}` call site also assumes "after"). This path feeds friendly-text conversion and export, so it carries the same silent character loss today.

3. **Round-trip self-check (the "structure check" you asked about).** Add a small guard in the inline math node's parse step: after building the tree, re-serialise it with `treeToLatex` and compare against the input. On mismatch, log a single diagnostic with the offending value instead of silently rendering mangled math. This makes any future parser regression of this class visible immediately rather than surfacing as stray `\frac` in a lesson note.

4. **Regression tests** — a small test file covering the exact quadratic formula plus nested cases (`\frac{3\sqrt{5}}{2\sqrt{5}-1}`, `x^{2^{5^n}}`, `\sqrt[3]{x_{1}}`), asserting `treeToLatex(latexToTree(v)) === v` and that `latexToFriendly` preserves every character.

## Verification

- Re-open this lesson note and confirm the Solution line renders as a real stacked fraction with `√(b² − 4ac)` intact and no visible backslashes.
- Confirm the Introduction block formula still renders (it uses the other renderer and must not regress).
- Run the new tests.

## Note on the backend

I will not change `notebook-ai`'s validator for this: the payload it emitted was well-formed. If you'd like, I can additionally have the server reject any generated line whose math fails a parse round-trip, as a belt-and-braces check — say the word and I'll add it to this plan.
