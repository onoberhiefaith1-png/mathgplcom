## Goal
Restore the Smartboard math structure to the working state from before the “save edited floating number” fix, without losing the important save behavior: teacher edits must still remain after Save and must still feed the presentation.

## Plan

1. **Do not use a full History revert as the first approach**
   - A full revert would also remove later fixes that are still needed.
   - Instead, make a targeted restore around the save/compile path that began the regression.

2. **Restore structure fidelity in the floating-number save path**
   - In `FloatingNumbersPage.tsx`, keep teacher-edited chips from being deleted on Save.
   - But stop converting saved chip values through broad display conversion when that changes math structure.
   - Preserve the exact teacher chip string as the source value, so fractions, roots, brackets, equals signs, plus signs, and grouped expressions remain as created.

3. **Restore structure fidelity in the compile path**
   - In `floatingCompile.ts`, compile the teacher’s saved fillers exactly, with no reconstruction.
   - Keep arrangement/order behavior, but avoid transforming chip strings in a way that can change the lesson-note structure.
   - This means the Smartboard receives the same chips the teacher saved, not a converted approximation.

4. **Keep the original lesson-note-to-smartboard structure rules intact**
   - Do not change the lesson-note mirror engine beyond the already planned revert of the placeholder regression.
   - Keep `□` placeholder flow as it was before the later placeholder experiment, because that was part of the working structure pipeline.

5. **Add focused safeguards**
   - Add a small parity rule around save/compile: if a teacher chip exists, the output chip must match it exactly unless the teacher explicitly edits it.
   - This protects cases like `+5x`, `=0`, `\frac{...}{...}`, `\sqrt{...}`, brackets, and combined structures.

6. **Verify the exact failure scenario**
   - Edit floating numbers on the generation page.
   - Press Save.
   - Confirm the edited chips remain visible after reload.
   - Open the Smartboard and confirm the presented structure matches the saved lesson-note/floating-number structure, not an empty or altered scaffold.

## What will not change
- No redesign.
- No changes to rotation UI.
- No changes to colors, layout, or cursor appearance.
- No new interpretation of the math.
- No AI reconstruction of teacher-saved chips.