# Game writing surfaces, navigation, and maths consistency

## Goal
Keep every question, note, and mathematical line fully inside its own expandable writing surface, preserve the existing gap between surfaces, add direct right-side navigation, and make line-one note and mathematical evaluation behaviour consistent across the Game, Smartboard, Floating Numbers, and Presenter paths.

## Plan

1. **Make one surface frame authoritative**
   - Calculate each surface from the rendered content height plus equal top and bottom writing margins.
   - Expand only the surface whose content grows; move later surfaces downward without changing the configured gap between surfaces.
   - Use the same frame for the visible panel, writing bounds, pointer target, text wrapping width, and scroll layout.
   - Replace post-render vertical correction that can move text outside its intended frame with a stable measurement update, preventing the existing repeated-update loop.
   - Preserve the current left margin, folds, line labels, room limits, materials, and Edit/Play appearance.

2. **Keep long content on the page**
   - Wrap prose and long mathematical working at the usable right edge.
   - Treat stacked fractions, square roots, exponents, multi-row work, and notes as full-height content before sizing the surface.
   - Reserve the same visible clearance above the first mark and below the last mark.
   - Retain infinite downward scrolling and the current inter-surface spacing.

3. **Add a right-side surface navigator**
   - Add a visible vertical scrollbar on the right of the Game view, driven by the existing camera scroll range.
   - Support dragging the thumb and clicking the track to move through the full stack.
   - Add surface markers so a teacher can jump directly to a writing surface without selecting each line in sequence.
   - Keep wheel, drag, keyboard, active-line focus, and Smartboard sensor behaviour unchanged.

4. **Use one mathematical display path**
   - Carry the existing structured board row as the preferred display source for student work and write-up content.
   - Parse expected and predictive strings through the same math-tree renderer so fractions, square roots, brackets, powers, and placeholders have the same classroom form in all four views.
   - Keep plain serialisation only for evaluation and persistence; never rebuild visible mathematics from a different ad-hoc parser.

5. **Integrate all evidence for evaluation**
   - Build one line snapshot containing expected mathematics, the student line, the predictive destination, and the actual structured board rows.
   - Use the shared local equivalence/parser result for immediate feedback and the authoritative grader for final marks and rewards.
   - Preserve a proven-correct result if a later background request fails or has no answer key.
   - Apply identical incomplete-bracket, `±`, implicit-multiplication, fraction, and square-root handling in the main and Floating Numbers evaluation paths.
   - Do not change scoring, full-mark reward gates, timer ownership, or activation logic.

6. **Correct line-one note loading**
   - Detect a true note-only first solution line from its saved `noteOnly/notebookOnly` flag and empty Floating Numbers range.
   - When line one is note-only, write its note automatically beneath question line zero when the question opens.
   - When line one has Floating Numbers or its own equation, leave it interactive and do not auto-write its note.
   - Use the same rule after opening, reset, question changes, and saved-game restoration without duplicate note writes.

7. **Verification**
   - Extend layout tests for equal top/bottom margins, tall maths, wrapping, independent growth, and unchanged gaps.
   - Add tests for scrollbar mapping and direct surface jumps.
   - Add note-only versus Floating Numbers line-one tests.
   - Add shared rendering/evaluation fixtures covering the quadratic-formula square root, redundant closed brackets, wrong signs, incomplete structures, and board-tree evidence.
   - Verify the current Game in the browser at desktop and narrow widths: long content remains contained, scrolling reaches every surface, line selection stays synchronized, and no repeated-update or runtime errors occur.

## Technical details
- Keep the existing 3D Slate and physical surface system; no redesign or replacement.
- The canonical surface calculation will remain in the shared Slate layout module and be consumed by both layout and rendering.
- The scrollbar will control the existing Game scroll state rather than introducing a second navigation state.
- Structured `Row` data remains the visible source of truth; its plain representation remains the mathematical comparison/persistence format.
- Existing immutable question text, reward rules, surface styling, sound behaviour, and sensor controls remain unchanged.
