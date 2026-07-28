## Goal

Placeholders must be visible again on every floating chip (√□, □^{□}, (□), □/□ …). The only thing that was ever wrong was the **fraction chip showing four cells instead of two** — the correction should be "one slot per real cell", not "no slots at all".

## What I verified so far

- The destructive `stripStructureShells` pass is already gone from `FloatingNumberPanel.tsx`; chip tokens now pass through a validation guard unchanged.
- The renderer itself is still placeholder-capable: rendering `x=\frac{□}{□}` produces exactly 2 slots and `\sqrt{□}` produces 1 slot (existing tests `floatingChipPlaceholders`, `boardShellPlaceholders` pass).
- So the missing squares are **not** coming from the panel's chip renderer — the tokens reaching it, or the slot styling used in that surface, must already be placeholder-free. I have not yet confirmed which of those two it is, so step 1 is a live trace, not an assumed cause.

## Plan

1. **Trace one real chip end-to-end (first step, no code change until this is answered).**
   Instrument/inspect the actual reservoir data on the assessment board: log the raw `reservoir.fragments` token strings and compare them against what Present Preview holds. This tells us whether the `□` is missing from the token (upstream extraction/mirror) or present but rendered invisibly (styling/slot path).

2. **If tokens lost their `□`** — repair at the point of loss, not in the panel:
   - `src/lib/smartboard/rowAscii.ts`: an empty `box` node currently flattens to an empty string, so a shell round-tripping through ASCII silently loses its slot. Emit `□` for an empty box.
   - `src/lib/smartboard/mathTree.ts`: the "drop redundant empty box inside a structural slot" rule must stay limited to *nested duplicates* (box inside a slot that already draws its own caret). It must never remove the slot itself, and must not apply to radicals, powers, brackets or standalone shells.

3. **If tokens are fine but slots are invisible** — restore visible placeholder styling for the floating surfaces (`FloatingNumberPanel`, `FloatingDisplayStrip`) by passing the placeholder colour through and making sure a non-focused slot still paints its outlined square.

4. **Enforce the real rule (fraction = 2 cells).**
   Keep the "adopt orphan `□` as numerator/denominator" repair in `mathRender.ts` so a brace-stripped `\frac□□` still draws one fraction with two cells — never a shell plus two loose boxes.

5. **Regression tests** (extend the existing files rather than adding new ones):
   - `x=\frac{□}{□}` → exactly 2 placeholder slots (already covered).
   - `±\sqrt{□}` → exactly 1 slot (must be visible, not stripped).
   - `□^{□}`, `(□)`, bare `□` chips → their slots survive.
   - A chip that is pure scaffolding is still displayed (no chip is dropped for "being empty scaffolding").

## Technical notes

Files in scope: `src/components/smartboard/FloatingNumberPanel.tsx`, `src/components/lessonnotes/FloatingDisplayStrip.tsx`, `src/lib/notebook/mathRender.ts`, `src/lib/smartboard/rowAscii.ts`, `src/lib/smartboard/mathTree.ts`, plus tests under `src/test/`. No backend or schema changes.
