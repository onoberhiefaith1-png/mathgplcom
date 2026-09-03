# Fix false "figure required" warning + broken fraction in solutions

Two separate defects seen in the Complementary Angles note.

## 1. Problem Check warns about a missing figure when none is needed

"Find the complementary angle of 67°" is a complete, self-contained question, yet
Problem Check shows *"This question refers to a figure, but no supporting diagram
or numerical information was detected."*

Confirmed cause (read from source): `src/lib/lessonnotes/problemDetect.ts` decides
this with its own loose local test `needsFigure()`, which fires on the bare word
`angle` (also `triangle`, `circle`, `shown`). The project already has the strict,
shared decision in `src/lib/lessonnotes/figureNeed.ts` (`figureNeeded`), written
precisely so the builder and the checker can never disagree — the checker is not
using it.

Fix:
- Delete the local `needsFigure()` and use `figureNeeded()` in both places that
  reference it (the blank-block branch and the "no relation on any math line" branch).
- Additionally require real figure dependency before warning: a question that
  already carries its own numbers (e.g. `67°`) and a solvable instruction is
  complete, so it must return `complete`, never `uncertain`.
- Keep the warning for genuine figure questions ("in the diagram below", "∠ABC",
  "Find x" with no data) — that path stays untouched.

## 2. `\frac` collapses to literal `rac...` text in a solution line

Solution 3 renders `rac3x3 = ...` instead of a stacked fraction `3x/3`. This is
the known JSON-transport mangle: an unescaped `\frac` becomes FORM FEED + `rac`.
The repair pass exists on both sides (`src/lib/lessonnotes/macroRepair.ts` and
`supabase/functions/notebook-ai/outputHygiene.ts`) but clearly did not run on this
line — the braces are gone too, meaning the text reached the brace-stripping /
unicode-math stage still mangled. The exact bypass point is **not yet confirmed**,
so step one is to reproduce it, not to guess:

1. Trace the string for this line through the notebook-ai response path
   (`index.ts` → `validator.ts` → `unicodeMath.ts` → `outputHygiene.ts`) and the
   client path (`sanitizePresentation` → `aiToNodes`), logging where `\f`/`rac`
   first appears without a backslash. Fix the ordering so macro repair always
   runs before any brace-stripping or unicode conversion.
2. Add a last-resort textual recovery (no control character left): a bare
   `rac{a}{b}`, `racab`-style residue immediately followed by two numeric/algebraic
   groups is rewritten to `\frac{a}{b}`. Same rule for `qrt` → `\sqrt`,
   `imes` → `\times`. Conservative patterns only, so ordinary words are never
   rewritten.
3. Ensure a mangled residue can never be emitted as plain text: the validator
   already flags empty-template slots — extend it to flag `rac`/`qrt` residue so
   generation self-corrects instead of publishing it.

## Technical notes

Files expected to change:
- `src/lib/lessonnotes/problemDetect.ts` (use shared `figureNeeded`, drop local regex)
- `src/lib/lessonnotes/macroRepair.ts` + `supabase/functions/notebook-ai/outputHygiene.ts`
  (textual fallback recovery, mirrored on both sides)
- `supabase/functions/notebook-ai/validator.ts` (residue rule) and pass ordering
  where repair is currently applied too late
- tests: extend `src/lib/lessonnotes/__tests__/emptyFraction.test.ts` and add
  Problem Check cases (`Find the complementary angle of 67°` → complete;
  `In the diagram below, find ∠ABC` → still warns)

Out of scope: pedagogy rules, QUESTION_LOCK, diagram tools, renderer visuals,
notebook layout, anything outside the two defects above.
