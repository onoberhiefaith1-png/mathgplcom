## Plan: Manual Highlight → Enter as the primary floating-number editor

### What will change
1. **Enter works without Generate**
   - Keep the equation lines visible as soon as the floating-number page opens.
   - The teacher can highlight any part of an equation immediately and press **Enter**.
   - The selection becomes a floating number even when the AI-generated filler row is empty.

2. **Manual Enter becomes an override, not just an add button**
   - If the selected expression is not already represented, add it as a new floating chip.
   - If Generate already produced scattered chips that match pieces of the highlighted expression, remove those scattered chips and replace them with the teacher’s combined chip.
   - If Generate produced one chip that is too large, and the teacher highlights only part of it, split/replace by keeping the teacher-highlighted chip and removing the oversized overlapping chip.
   - This makes manual highlighting the teacher’s correction tool for both “too separated” and “too combined” AI output.

3. **Glow matching generated chips while highlighting**
   - While the teacher highlights text in the equation, existing generated chips that overlap or match the highlighted expression will glow with the same yellow highlight style.
   - This gives immediate feedback: “these are the chips that Enter will replace/group.”

4. **Preserve real math structure from the highlight**
   - Do not rely only on `selection.toString()` when the rendered equation contains structured math.
   - Capture selection from the source equation and preserve structures such as:
     - stacked fractions like `\frac{dy}{dx}` instead of flattening to `dy/dx`
     - powers like `a^{x+y}` or `a^{□}` when only the base is selected
     - paired brackets as a unit, never one bracket alone
     - radicals, derivatives, logs, trig/function brackets, and absolute values
   - The floating chip should render with the same classroom structure the teacher highlighted.

5. **Keep the current page location**
   - Work on the generated floating-number page (`/floating/...`), not the highlight-preparation page.
   - Leave the first highlight-preparation page behavior alone.

### Technical approach
- Update `FloatingWorkspace` so the Enter handler works for every visible equation line regardless of whether `line.fillers` is empty.
- Improve selection mapping: use the rendered selection range plus the line’s original equation string to recover the correct source math markup, especially for fractions and other structured spans.
- Add a small manual-override helper that:
  - normalizes the teacher’s selected chip,
  - detects generated fillers that are contained inside the selection,
  - detects generated fillers that contain the selection,
  - removes those affected fillers,
  - inserts the teacher’s selected chip once,
  - keeps/adds the needed structure container.
- Extend the existing `manualFloatingPromoter` rules for bracket pairing and structured source preservation.
- Add focused tests for:
  - `let` remains one word, not letters,
  - `\frac{dy}{dx}` remains a stacked fraction chip,
  - grouping scattered `u`, `dv`, `dx` into one selected chip,
  - replacing an oversized `3x+1` chip with selected `3x`,
  - base-only power selection adds the power container/empty exponent shell.