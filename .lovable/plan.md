## Plan

1. **Remove computer math notation from teacher-facing screens**
   - Update the Floating Number highlight summary so selected items render through the same Lesson Note math renderer instead of monospace raw text.
   - Add a display-safety helper for floating chips so `\frac`, `\sqrt`, `^{}`, `_{}`, slash fractions, and template placeholders never appear as literal text.
   - Use that helper in Floating Number chips and Smartboard floating-number strips, so teachers see stacked fractions, radicals, and raised powers only.

2. **Fix manual highlight generation order**
   - Make manual click/apply preserve the teacher’s order permanently: first selected chip stays first, second stays second, third stays third.
   - Stop resetting line arrangements with the old rearrange/shuffle pattern after manual atom selection, chip removal, or chip edits.
   - Keep AI-generated order untouched separately, but ensure manual selections are saved and compiled in their entered order.

3. **Rebuild highlighted vs unhighlighted lesson-line pairing**
   - Treat highlights as the line boundaries.
   - Any unhighlighted content before the first highlight becomes a notebook-only first line.
   - Any unhighlighted content between highlight A and highlight B belongs to highlight A’s notebook checkpoint.
   - Highlighted math is stored only as floating numbers; it must not appear inside the notebook checkpoint.

4. **Activate strict presentation notebook gating**
   - On the Smartboard, each presentation row becomes:
     ```text
     top: highlighted floating numbers, if any
     bottom: notebook checkpoint from unhighlighted lesson-note content, if any
     ```
   - If a line has a notebook checkpoint, freeze floating-number progression until the teacher taps the notebook icon.
   - Tapping the notebook icon writes only the unhighlighted content to the board using the Lesson Note renderer.
   - Teacher may choose not to use all floating numbers, but cannot proceed past a line’s checkpoint before reading it.
   - Keep the +3 row movement limit.

5. **Validate visually**
   - Check the floating prep page and Smartboard presentation page for visible raw `\frac`, `\sqrt`, `^{}`, `_{}`, `sqrt(`, or slash-fraction display.
   - Confirm manual click order remains first-in-first-out after generating and saving.