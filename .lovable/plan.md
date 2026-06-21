## Goal

Make the Floating Numbers "AI Edit → Generate" button behave like a smart auditor: when a teacher clicks it, they should see a live checklist of what is being verified, what failed, what is being fixed, and the final verdict. Today the backend silently returns the same fillers when nothing improves, so the teacher sees "no change" with no explanation.

## What changes

### 1. Backend: `supabase/functions/notebook-ai/index.ts` — `floating_line_edit`

Replace the current "extract → maybe repair → return chips" flow with an explicit **diagnostic pipeline** that records each check and its outcome, runs repairs, then re-checks. The response gains a `diagnostics` array.

Checks run in order on the current `{ equation, fillers, containers }`:

1. **All terms present** — every term in `sourceEquation` (numbers, identifiers, signs around `=`) appears in `fillers`. Reuses `verifyCompleteness` plus a new "term-before-equals" guard that explicitly checks each side of `=` is non-empty and contains at least one filler.
2. **No hidden signs in chips** — uses `verifyFloatingLine` `NoHiddenSign`.
3. **Atomic terms only** — `verifyFloatingLine` `AtomicTerm` / chip-split rules.
4. **Containers match shells** — `verifyFloatingLine` container-kind law.
5. **Coverage of integrand / fraction parts** — `verifyFloatingLine` coverage law.
6. **Five floating-number laws overall** — aggregate pass.

For each check the backend pushes:
```
{ id, label, status: "pass"|"fail"|"fixed", detail }
```

Flow:
- Run all checks → if all pass, return `status:"clean"` with diagnostics (all `pass`) and unchanged chips.
- If any fail, run the existing AI repair loop (up to 2 attempts) using the failure list as feedback. After each attempt, re-run the same checks. If a previously-failing check now passes, mark it `fixed`.
- Always return: `{ equation, fillers, containers, diagnostics, status: "clean"|"fixed"|"unresolved" }`.

When `instruction` is non-empty, run the existing rewrite step first, then the diagnostic pipeline on the rewritten line.

### 2. Frontend: `src/components/lessonnotes/AiEditPanel.tsx`

While generation is running and after it returns, render the diagnostics as a **live checklist** in the preview area (above the chip preview). Each row:

```
✓  All floating numbers present
✓  No hidden signs inside chips
⟳  Checking atomic terms…
✗  Term before "=" missing  →  fixing…
✓  Fixed: term before "=" now present
```

Icons: `⟳` running, `✓` pass, `✗` fail, `✦` fixed. Footer line:
- `status:"clean"` → "All checks passed — floating numbers are correct."
- `status:"fixed"` → "Errors found and fixed. Review the chips below."
- `status:"unresolved"` → "Could not fix automatically. Please add an instruction and regenerate."

The list streams in by revealing rows one at a time on a short interval (cosmetic; data is already in the response) so the teacher visibly sees "check, check, check".

### 3. Frontend: `src/pages/FloatingNumbersPage.tsx`

- Pass through diagnostics into `AiEditPanel` via the existing `renderProposed` (or a new `diagnostics` prop on the panel).
- Apply button stays disabled while `status:"unresolved"` unless the teacher confirms.

## Out of scope

- The five floating-number laws themselves, deterministic extractor internals, lesson-note AI Edit flow, equation structure, integrity/inheritance/QUESTION_LOCK rules, DB schema, RLS.

## Files touched

- `supabase/functions/notebook-ai/index.ts` — diagnostic pipeline + response shape.
- `src/components/lessonnotes/AiEditPanel.tsx` — checklist UI with streaming reveal.
- `src/pages/FloatingNumbersPage.tsx` — wire diagnostics into the panel.
