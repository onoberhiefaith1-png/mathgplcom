Diagnosis
- The whiteboard math-tree placeholder path already uses `#efece5`, but the lesson-note/solved renderer has a separate placeholder path.
- In `src/lib/notebook/mathRender.ts`, empty `\sl{}` placeholders still render with `currentColor` / a `□` glyph, so they inherit the board ink color. That matches the black boxes visible in your screenshot.
- The fix should separate “structure ink” from “placeholder color” everywhere: fraction bars, radical hooks, numbers, and symbols keep ink color; empty placeholders use their own color only.

Plan
1. Add a real placeholder color setting
   - Expand the existing placeholder color source into a small setting model, similar to ink color.
   - Store it in localStorage so it persists.
   - Default whiteboard placeholder to `#efece5`.
   - Include a board-match option for whiteboard and blackboard, plus a few manual swatches.

2. Wire the setting through Smartboard
   - Add `placeholderColorId` state in `PresentationView`.
   - Resolve it to an actual color based on the active board surface.
   - Pass `placeholderColor` separately from `ink` into board renderers.

3. Rewrite placeholder rendering boundaries
   - Update `MathTreeRender` so structures continue using `currentColor`/ink, but empty sub-slots always use `placeholderColor`.
   - Update `BoxLayer` so empty magnet boxes use `placeholderColor`; filled box text still uses ink.
   - Update `renderMathInline` so lesson-note `\sl{}` placeholders and unbalanced fraction/sqrt empty slots stop using `currentColor` and use `placeholderColor` instead.
   - Keep active/focused caret indicators in ink so the teacher can still find the cursor.

4. Add placeholder color control in Settings
   - Add a “Placeholder Color” section below Ink Color.
   - Use swatches like Ink Color, but changing it only affects empty placeholders, not numbers, bars, radicals, or text.

5. Test the exact failure case
   - Open the smartboard route.
   - Insert/render a fraction from the floating-number/lesson-note path.
   - Verify with DOM computed styles that placeholder borders/fills/glyphs use the selected placeholder color, while the fraction bar stays ink-colored.
   - Check whiteboard default blends, and blackboard still allows its own matching placeholder color.