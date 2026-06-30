## Problem

Teacher's preparation chip `+5x` is showing on the Smartboard as `5x` — the leading `+` is silently stripped during presentation compile.

Root cause: `src/lib/smartboard/presentation.ts` calls `dropContextualLeadingPlus(...)` on the teacher's already-edited, already-arranged chip list in two places:
- Line 349 — per-line fills built from `rl.fillers` (the teacher's saved fillers, in arranged order).
- Line 376 — `bucketCombined` built from `bucket.fillers` (the teacher's compiled bucket).

That helper assumes chips are in equation order and strips `+` from any chip whose previous chip is empty / `=` / `±`. After the teacher shuffles, `+5x` lands first and gets clobbered to `5x`. The very point of the preparation page is that the teacher's edited chips are the source of truth — the Smartboard must mirror them verbatim.

## Fix (single rule: "Teacher chips are immutable")

Treat teacher-supplied chip strings as final once they leave the preparation page. The Smartboard performs zero sign-aware transformation on chips that originated from `rl.fillers` or `bucket.fillers`.

### Code changes (presentation.ts only)

1. **Per-line fills (around line 340-349)** — when `rl.fillers` exists, skip `dropContextualLeadingPlus`. Apply the `arrangement` map and `cleanFragments` (whitespace / empty cleanup only), then push verbatim. Only when fillers had to be derived via `fillersFromEquation(eq)` (no teacher input) may `dropContextualLeadingPlus` run, because those came from raw equation parsing.

2. **Bucket fallback (around line 376-384)** — `bucket.fillers` and `bucket.viewCombined` are teacher-curated. Drop the `dropContextualLeadingPlus` wrapper for these two branches. Keep it only on the `solutionFallback` path (purely machine-derived from `solutionLines`).

3. **Add a teacher-chip parity guard** — after assembling `fragments`, assert each fragment string is byte-identical to the teacher's source (`bucket.fillers[i]` or `rl.fillers[i]`). If not, `console.warn` with both values and fall back to the teacher string. This makes any future regression visible immediately instead of silently mis-rendering on stage.

### What stays untouched

- `dropContextualLeadingPlus` itself — still correct for machine-extracted fillers from raw equations.
- `cleanFragments` — only trims whitespace / drops empties; safe to keep on the teacher path.
- Chip rendering, ordering, rotation, used-zone logic — unchanged.
- Preparation page — unchanged; it remains the single source of truth.

### Verification

- Reload the quadratic-formula notebook used in the screenshot; the first row chips must read exactly `+5x  =0  2x²  +3` on the Smartboard, matching the preparation panel.
- Run existing tests: `floatingHighlightsBackend`, `floatingExtractorBackend`, `manualFloatingPromoter`. Add a regression test asserting that a teacher chip beginning with `+` survives `buildReservoirs` unchanged when present in `bucket.fillers`.
- Manually shuffle chips on the preparation page (move `+5x` to position 1) and re-open the presentation — sign must persist.

## Files touched

- `src/lib/smartboard/presentation.ts` — remove sign stripping on teacher-sourced chips, add parity guard.
- `src/test/` — new small regression test for the teacher-chip parity rule.
