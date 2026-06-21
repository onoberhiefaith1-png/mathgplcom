## Plan: Smart floating-number audit and repair

### Goal
Make **AI Edit** understand that clicking **Regenerate** means: the current floating numbers are wrong, so it must audit the selected equation line, find missing chips one by one, regenerate the complete chip list, then let the teacher apply it.

### What will change

1. **Replace the weak “all floating numbers present” check**
   - Instead of checking only whether each side of `=` has *some* token, generate an exact expected-chip checklist from the original equation.
   - Compare **expected chips vs actual chips one by one**.
   - If the left side has `3x²`, `+5x`, `+10`, those exact chips must be found before the `=` chip.
   - If any expected chip is missing, the diagnostic must say exactly what is missing, e.g.:
     - `Missing before =: 3x², +5x, +10`
     - `Missing after =: A, x, −1, Bx, +C, x², +4`

2. **Use deterministic extraction as the truth source**
   - For the selected equation, the backend will compute the expected floating-number chips using the deterministic extractor.
   - This becomes the audit answer key.
   - AI output cannot claim “complete” unless it matches that answer key.

3. **Add visible per-chip checking in AI Edit**
   - The Smart Check panel will show rows like:
     - `Checking left side: 3x² — present`
     - `Checking left side: +5x — missing`
     - `Checking equals sign — present`
     - `Checking right side: A — present`
   - Missing chips show as failed rows before repair.
   - After regeneration fixes them, those rows show as fixed.

4. **Regenerate means “repair from the error report”**
   - When the teacher clicks **Regenerate**, the backend will:
     1. Build the expected chip checklist.
     2. Compare current/proposed chips against it.
     3. Write the missing-chip report.
     4. Regenerate using that report.
     5. Re-check the regenerated chips.
   - If the regenerated version still misses anything, it returns `unresolved` and lists what is still wrong.

5. **Apply only after a correct repair**
   - If status is `clean` or `fixed`, **Apply Changes** replaces the wrong row on the floating-number page.
   - If status is `unresolved`, keep the teacher on AI Edit so they can click **Regenerate** again or add text/voice instruction.

6. **Keep teacher controls**
   - Keep text instruction, voice input, and file/text concept controls already present in the AI Edit flow.
   - Empty Regenerate still works as “find the error and fix it.”

### Technical details

- Update `supabase/functions/notebook-ai/index.ts` in `floating_line_edit`:
  - Add an expected-chip coverage function based on `deterministicExtractLine(sourceEquation)`.
  - Compare normalized chips by side, preserving `=` boundaries.
  - Return structured diagnostics for each expected chip plus law checks.
  - Feed missing-chip details into the repair prompt.
  - Final status is only `clean`/`fixed` when expected coverage and floating-number laws both pass.

- Update `src/components/lessonnotes/AiEditPanel.tsx`:
  - Render per-chip diagnostic rows clearly.
  - Disable or guard Apply when diagnostics are unresolved.
  - Keep Regenerate available in preview mode.

- Update `src/pages/FloatingNumbersPage.tsx`:
  - Pass the current line’s existing fillers/containers to the backend so AI Edit can audit what is currently wrong, not just the equation text.
  - Store returned diagnostics/status and apply only returned fixed fillers/containers.

### Expected result
When the first floating numbers before `=` are missing, AI Edit will no longer say “all floating numbers present.” It will list the missing chips, regenerate them, re-check them, and only then allow the teacher to apply the corrected floating numbers.