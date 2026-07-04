# Fix Solution Preview: Real Equations, Floating Numbers, Notes — No `[object Object]`, No LaTeX Symbols

## What is wrong (root cause found)

- The preview page feeds the math renderer's output into a raw-HTML slot. The renderer produces React elements, and the browser prints them literally as `[object Object],[object Object]`. Your saved data is clean — `2x² + 5x + 3 = 0` and all floating numbers are stored correctly. It is purely a display wiring bug on this one page.
- Notes (e.g. "The quadratic formula is x = \frac{-b ...}") skip the math renderer entirely, so raw LaTeX symbols leak onto the screen — a violation of the fundamental law.

## What will change

**Each Solution renders as numbered display lines — the exact same line structure as the Floating Number generating page (1:1 with the Smartboard):**

For every line (Line 1, Line 2, Line 3 … unlimited, universal rule):

1. **Equation on top** — properly rendered math (stacked fractions, real square roots, superscripts), amber-highlighted, e.g. `ax² + bx + c = 0`. Never `[object Object]`.
2. **Floating numbers underneath** — the exact chips already generated on the Floating Number page, in the same order (e.g. `2x²` `+5x` `+3` `=0`), rendered as real math.
3. **Note underneath** — with the same quality notebook note icon used on the Smartboard, its text also passed through the math renderer so no `\frac`, `\sqrt`, `^{}` ever appears.
4. If a line has only a note and no floating numbers, only the note shows — but it still counts as its own line.
5. If the teacher has **not yet generated** floating numbers for the lesson, the chips area shows **"Not yet available"** instead of guessing.

**One AI Edit button per line** — it covers all three segments together (equation + floating numbers + note), sending the full line context so the AI can correct any of them.

**Fundamental law enforced everywhere on this page:** every piece of text (problem, equation, chips, notes, explanations) goes through the classroom math renderer before display. Raw computer syntax (`\frac`, `\sqrt`, `^{2}`, `[object Object]`) can never appear. This is fixed at the rendering layer, so it holds for 6 lines or a million lines.

## What does NOT change

- Floating Number generating page, Smartboard live view, Lesson Note data — untouched.
- Present / Skip toggles and Approve & Go Live — kept as they are.
- Notes above the Cover / Introduction sections — already correct, kept.

## Technical details

- `src/pages/SmartboardPreviewPage.tsx` (only file edited):
  - Replace `InlineMath`'s `dangerouslySetInnerHTML={{ __html: renderMathInline(...) }}` with direct React children rendering `{renderMathInline(ascii)}` — this alone kills every `[object Object]`.
  - `NoteBlock` and explanation text: render via `renderMathInline` (or `SmartboardLessonText`) instead of plain text, eliminating raw LaTeX.
  - Reorder the per-line layout to: equation (HighlightBox) → FloatingChips → NoteBlock, matching the Floating Number display line; add per-line numbering context and a "Not yet available" chip state when `floating_lines` is empty for that subsection.
  - Single `AiEditPopover` per line, payload includes equation + fillers + note.
- Verify with Playwright screenshot of `/smartboard/:id/preview` on the quadratic lesson before finishing.
