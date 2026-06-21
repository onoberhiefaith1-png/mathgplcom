## Plan: make floating numbers complete and editable per line

### 1. Fix the missing-left-side issue from the screenshot
- Strengthen the `floating_highlights` backend prompt so each highlighted equation is treated as an indivisible source span.
- Add an explicit equation-side rule: if a highlight contains `=`, the output must preserve and extract both the left-hand side and right-hand side; starting after `=` is invalid.
- Add retry wording that names the exact missing side/elements when the AI omits them.

### 2. Add a hard completeness gate for every highlight
- Run `verifyCompleteness(highlight.payload, generatedEquation)` per highlight, not just for the whole solution mode.
- If a generated highlight is incomplete, retry once with the missing variables/numbers/structures.
- If it is still incomplete, ignore the AI equation and deterministically extract directly from the original highlight payload so the left side, right side, fractions, brackets, powers, and equals sign are never dropped.

### 3. Make deterministic fallback the final authority
- For math highlights, use the original highlight payload whenever the AI output fails the completeness check or changes the expression too much.
- Keep the existing deterministic extractor/verifier as the final chip splitter, so the five floating-number laws still govern the final fillers and containers.

### 4. Add “AI Edit / Regenerate” for one floating line
- Reuse the existing lesson-note `AiEditPanel` pattern on the floating-number page.
- Add a per-line action beside each equation: `Regenerate` / `AI Edit`.
- The panel will show the current line, let the teacher type or speak instructions, and generate only that line’s floating numbers.
- Applying the result replaces only that one line’s fillers, containers, and arrangement; all other floating lines stay untouched.

### 5. Backend endpoint for one-line regeneration
- Add a narrow `floating_line_edit` mode to `notebook-ai`.
- Input: problem context, current equation/highlight payload, existing fillers/containers, and teacher instruction.
- Output: one line only: `{ equation, fillers, containers }`.
- Apply the same prompt rules, completeness verification, deterministic extraction, and floating verifier before returning.

### 6. Validation tests
- Add tests for the screenshot-style partial-fraction equation to ensure chips include the left side before `=`.
- Add tests for highlight completeness when the AI response starts after `=`.
- Add tests that one-line regeneration returns a complete line and does not affect neighboring lines.