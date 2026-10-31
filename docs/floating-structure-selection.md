# Floating structures and teacher-selected contents

## Reported problem

Opening the Floating Numbers editor filled matrix rows before the teacher pressed
Generate. On the equation, a matrix, bounded sum/integral or accented expression
was one opaque clickable atom, so a cell such as `1×2+2×1+0×0` could not be refined.

## Change

Opening is restoration only: an unsaved highlighted line starts with empty
fillers/containers, and saved manual chips are retained as written. No automatic
matrix-chip migration runs during loading. Explicit Generate remains available.

The shared equation parser now models supported layouts as one empty structure
shell plus selectable slot contents. Matrices retain their environment, row and
column counts. A bracket click selects the empty grid; cell numbers/operators
are individually selectable, and consecutive selections can form a larger chip.
Slot boundaries prevent accidental joins between unrelated cells. Selecting a
shell with selected contents creates a deliberately blended structure, with
placeholders in its unselected cells.

The same mechanism covers bounded sums/products/integrals/limits, accents,
binomial coefficients and supported bracket/norm/floor/ceiling groups. Existing
fractions, radicals and derivative fractions keep their established selection
engine. Unknown or incomplete layouts remain lossless opaque fallbacks; this
is not a claim to parse every possible LaTeX macro or custom environment.

No changes to mathematical answers, evaluation, timing, teacher data, AI prompts,
backend functions or database schema. Existing teacher-owned chip strings are
not rewritten when the editor reconstructs click ownership.

## Validation

274 targeted tests pass across 17 files. New cases include the reported cell
fragments (`1`, `1×2`, `×2`, `2`, and the full expression), empty 3×3 shell,
intentional shell/content blends, nested fraction/matrix cells, slot boundaries,
per-bound selection, reload preservation and real React clicks on a number,
matrix bracket and summation bound. Existing matrix shell, emoji, notation,
Smart Table, Physics/Chemistry and lesson ownership tests pass.

The pure parser/selection helpers pass a strict targeted TypeScript check;
changed page/components pass syntax checks. The partial checkout has not had a
full production build. An isolated Vite preview was prepared, but the available
browser could not reach the local listener, so no visual browser pass is claimed.
The React click tests ran with JSDOM; they are not a live-site verification.

## Release check

After draft approval, build and publish the frontend through the existing hosting
workflow. This change does not require an AI/function deployment or Lovable to
rewrite code. On the actual highlighted question: opening a new empty workspace
must not add chips; select its bracket and apply an empty grid; select individual
numbers and ranges in one cell; save/reload; test on Smartboard and fill cells.
Repeat with integral limits, a summation bound, an accent and a derivative
fraction. Preserve the teacher's existing choices; do not regenerate them simply
to open the page. Previously saved chips remain until the teacher edits them or
explicitly presses Generate.
