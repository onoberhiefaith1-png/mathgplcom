# Plan: Make AI Edit handle hard cases (integrals) and give a clear recovery flow when it can't auto-fix

## What went wrong on this line

The selected line is:

```
∫( 18/(5(x − 1)) + (−3x + 22)/(5(x² + 4)) ) dx
```

The deterministic extractor does not know how to drill INTO an integral. It treated the whole thing as a single chip, so:

- "Fixed: expression" row shows the entire integral as one chip (with `\frac{...}{...}+\frac{...}{...}` inside it).
- "No hidden signs inside chips" fails (the chip contains `+`, `−`).
- "Five floating-number laws satisfied" fails for the same reason.
- The repair step just re-ran the same extractor, got the same single chip, and gave up with **"Could not fix automatically. Add an instruction and regenerate."** — the teacher is left stuck with no useful next move.

Two things must change:

1. The extractor must know how to decompose `∫ ( … ) dx` (and a few similar wrappers) into proper chips.
2. When auto-repair genuinely cannot resolve a line, the panel must give the teacher a concrete, guided path forward instead of a dead end.

---

## Part 1 — Teach the extractor to handle integral wrappers

Files: `supabase/functions/notebook-ai/floatingExtractor.ts` (and mirror the same change in `src/lib/smartboard/floatingExtractor.ts` so the smartboard stays consistent).

Add an **integrand unwrap** pass that runs before term splitting:

- Detect patterns shaped like `∫( BODY ) dx`, `∫ BODY dx`, `\int( BODY ) dx`, `\int BODY \, dx`.
- When matched:
  - Push the integral shell `∫()dx` as a **container** chip (already a supported container kind).
  - Recurse `extractTermsFromAscii(BODY)` so each fraction / term inside becomes its own chip:
    `\frac{18}{5(x-1)}`, `+\frac{-3x+22}{5(x^2+4)}`.
  - The variable of integration (`x` from `dx`) is recorded but not emitted as a chip.

Apply the same "drill into the body" rule to two close cousins that hit the same bug:
- Summations `∑(BODY)` / `\sum BODY`.
- Limits / products that wrap a body in parentheses with a trailing operator.

After this pass, `verifyFloatingLine` will see atomic chips (each fraction is a single shell, not a sum) and the "No hidden signs" + "Five laws" checks pass automatically.

Add unit coverage in `src/test/floatingExtractorBackend.test.ts`:
- `∫(18/(5(x-1)) + (-3x+22)/(5(x²+4))) dx` → 2 fraction chips + `=` if present + `∫()dx` container.
- `∫ x² dx` → 1 power chip + `∫()dx` container.
- Same forms with `\int` LaTeX source.

## Part 2 — Real recovery flow when auto-repair returns `unresolved`

Files: `supabase/functions/notebook-ai/index.ts` (response shape) and `src/components/lessonnotes/AiEditPanel.tsx` (panel UI), wired through `src/pages/FloatingNumbersPage.tsx`.

Today, on `status: "unresolved"` the panel shows one red line: *"Could not fix automatically. Add an instruction and regenerate."* Replace this with a structured **Recovery Steps** block that lists, in order, what the teacher can actually do.

### Backend additions

Extend the `floating_line_edit` response with a `recovery` object when `status === "unresolved"`:

```ts
recovery: {
  reason: "structure_not_decomposed" | "law_violation" | "missing_terms" | "unknown",
  summary: string,              // one human sentence, e.g.
                                // "The integral could not be split into separate fraction chips."
  hints: string[],              // ordered checklist the UI renders
  suggestedInstructions: string[], // canned one-click instructions
  canRevert: boolean,           // true when currentFillers were valid before
}
```

Reason is inferred from the diagnostic set:
- All per-chip rows pass but laws fail with `NoHiddenSign` on a chip containing `∫`, `∑`, or `\frac` next to `+`/`−` → `structure_not_decomposed`.
- Per-chip rows have `fail` after repair → `missing_terms`.
- Only law rows fail → `law_violation`.

`suggestedInstructions` are pre-written, equation-aware nudges the panel can offer as one-click chips, e.g. for an integral case:
- *"Split the integral into two separate integrals, one per fraction."*
- *"Expand the integrand into a sum of separate fractions before integrating."*
- *"Combine the fractions over a common denominator first."*

### Frontend changes (`AiEditPanel.tsx`)

When `getDiagnostics()` returns `status === "unresolved"`:

1. Keep the Smart Check checklist visible so the teacher sees exactly which row failed.
2. Below the checklist render a **Recovery Steps** card:
   - Step 1 — show `recovery.summary` in plain language.
   - Step 2 — render `recovery.hints` as a numbered checklist.
   - Step 3 — render `recovery.suggestedInstructions` as clickable chips. Clicking one fills the instruction box and immediately calls Regenerate.
   - Step 4 — keep the existing text / voice / file-upload controls so the teacher can override with their own instruction.
3. Disable the **Apply Changes** button (already wired) and add a secondary **Keep current chips** button when `recovery.canRevert` is true, so the teacher can bail out without losing the previous state.
4. Add a one-line status pill at the top: *"Auto-fix could not resolve this line. Choose a recovery step below."* in amber, not red, so it reads as guidance instead of a hard error.

### Page wiring (`FloatingNumbersPage.tsx`)

- Capture `recovery` alongside `diagnostics` in `aiEditDiagRef`.
- "Keep current chips" closes the panel without dispatching an update.
- Clicking a suggested instruction calls `runAiEditForLine(line, instruction)` and re-opens the preview.

## Part 3 — Documentation / pedagogy reference

Add a short section to `supabase/functions/notebook-ai/pedagogyReference.ts` (PEDAGOGY_REFERENCE) describing the integral / summation decomposition rule, so when the AI rewrites the equation in Part 2 (via teacher instruction) it follows the same conventions and produces text the extractor can split.

## Out of scope (explicitly not changed)

- Five floating-number laws themselves.
- `floatingVerifier.ts` logic.
- Lesson-note AI Edit flow (only the floating-numbers path).
- DB schema, RLS, QUESTION_LOCK, inheritance enforcement.

## Acceptance

- Opening AI Edit on the integral equation in the screenshot produces 2 fraction chips inside an `∫()dx` container, all five laws pass, status `clean` or `fixed`, **Apply Changes** becomes available.
- Forcing an unresolvable case (e.g. an unsupported structure) shows the Recovery Steps card with at least one suggested instruction; clicking it regenerates without the teacher typing anything.
- Existing passing cases keep passing — no regression in `src/test/floating*` tests.
