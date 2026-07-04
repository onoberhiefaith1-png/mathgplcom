
# Note-Attachment Consistency Law

## The problem you saw

On the smartboard, Line 4 showed a note icon even though your Floating Number Display had no note on Line 4. Clicking it revealed the entire solution from Line 5 to the end, and Line 5's `c = 1` got pushed down leaving a gap the sensor couldn't cross.

Root cause: two independent code paths can attach a note to a line, and they don't agree.

1. **The truth path** — each highlight the teacher pinned in the Floating Number generator carries its own `precedingNotebook` (the prose sitting directly above that highlight). This is what the Floating Panel renders.
2. **The fallback path** in `src/lib/smartboard/presentation.ts` (line ~402):

```ts
const notebook =
  (rl as any).notebook                       // truth
  || notebookByPayload.get(eq)               // ← guesses by equation
  || undefined;
```

`notebookByPayload` is a lookup keyed by equation payload built from ALL highlights in the sub. When Line 4's equation happens to match a payload string that belongs to a different line (or matches a "wrapper" highlight whose `precedingNotebook` was written to cover several later lines), the wrong prose latches onto Line 4. That's exactly what you saw: a stray highlight whose `precedingNotebook` contained the tail of the solution got attached to Line 4 by equation match, not by ownership.

`parseSolutionExplanations` is a second silent injector: if the Lesson Note's `solution` ASCII has any prose row between equations, it becomes that line's `explanation`, and the Floating Number generator may then wrap it into `precedingNotebook` for the highlight above, producing the same phantom-note effect.

## The rule

> **A Lesson Line owns a note if and only if the Floating Number Panel authored one for that exact line. Nothing else may inject, inherit, guess, or fall back a note onto a line.**

Applied consistently across every line, every session, every reload — no line has a note unless its own highlight carried `precedingNotebook`.

## Changes

### 1. `src/lib/smartboard/presentation.ts` — remove the equation-match fallback

In the `sourceLines` builder (the `rawHighlights.reduce` branch, ~line 335) each highlight already carries its own `precedingNotebook` and it's the only prose it owns. Keep that. But at the merge point ~line 402, drop the `|| notebookByPayload.get(eq)` fallback:

```ts
const notebook = (rl as any).notebook || undefined;
```

Also delete the `notebookByPayload` map (lines 310–317) so no other code path can re-introduce the guess.

### 2. Notebook prose can only come from an explicit highlight

In the fallback branches (`rawLines` path and `solutionLines` path, ~lines 364–366) never populate `.notebook`. Those paths run when the teacher never opened the Floating Number generator; in that case there is by definition no authored note, so the line renders alone.

### 3. `parseSolutionExplanations` no longer feeds `.notebook`

Its output stays available as `.explanation` for the structures/symbols assistant, but the merge step must NOT copy `explanation` into `notebook`. Confirm the assignment at ~line 399–402 keeps `explanation` and `notebook` on separate fields — no cross-copy.

### 4. Runtime guard in `PresentationView.tsx`

`notebookFor(k)` (line 3318) already returns `guidedLines[k].notebook`. Tighten it to also require the note not to be the whole remainder of the solution — a cheap sanity check:

```ts
const notebookFor = (k: number): string => {
  const nb = (guidedLines[k]?.notebook ?? "").trim();
  if (!nb) return "";
  // Guard: a legitimate line note is short prose, not the tail of the
  // solution. If it contains 2+ equation-shaped lines, refuse to show it.
  const equationLines = nb.split(/\r?\n/).filter((l) => /[=+\-−×÷/^]/.test(l)).length;
  if (equationLines >= 2) return "";
  return nb;
};
```

This is a belt-and-braces safety net: even if a bad note slips through generation, the board won't render it.

### 5. Test coverage

Add `src/test/noteAttachmentConsistency.test.ts`:

- A sub with three highlights where only Highlight 2 has `precedingNotebook`. Assert `buildReservoirs` returns notes on line 2 only — lines 1 and 3 have `notebook === undefined`.
- A sub where two highlights share the same equation payload; only one carries `precedingNotebook`. Assert the other line stays note-free (no equation-match spill-over).
- A sub whose `solution` ASCII has prose between equations. Assert `buildReservoirs` leaves `.notebook` unset on every line (prose only feeds `.explanation`).
- A note whose text contains multiple equation-shaped lines. Assert `notebookFor` on the board rejects it and returns `""`.

## Files touched

- `src/lib/smartboard/presentation.ts` — remove `notebookByPayload` fallback and prose-to-notebook leak.
- `src/components/smartboard/PresentationView.tsx` — tighten `notebookFor`.
- `src/test/noteAttachmentConsistency.test.ts` — new.

## Result

Line 4 will never show a note again unless you explicitly authored one on Line 4 in the Floating Number Display. The same law protects every line, every session, every regenerate — highlighted = floating number, unhighlighted = note, and nothing gets to fake a note by equation match, prose spill-over, or index drift.
