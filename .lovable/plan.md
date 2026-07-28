## What I verified

- `TeacherReasoningPanel.tsx:342` renders the Expected line inside a `<pre className="font-mono">` printing raw text — that is why `x₁ = \frac−42` appears. The Student line (line 354), the floating chips (line 404) and the student-introduced terms (line 419) all do the same.
- The Presenter Preview "normal mode" orange equation does it correctly: `PresenterPreviewPanel.tsx:695-751` takes `line.equation`, wraps it in `InlineMath`, which calls `renderMathInline(...)` from `src/lib/notebook/mathRender.ts` — real stacked fractions, superscripts, radicals.
- Expected line data currently comes from `keyLines.tokens.join(" ")` (`TeacherReasoningPanel.tsx:233-236`), even though the answer key now carries `equationAscii` (`createAssessment.ts:143`, already consumed by `grade-line/index.ts:110`). The panel is showing the token list, not the teacher's orange equation.

## Plan

### 1. Share the presenter's math renderer
- Extract the `InlineMath` renderer used by Presenter Preview into a small shared component (`src/components/smartboard/PresenterMath.tsx`) wrapping `renderMathInline`, and have `PresenterPreviewPanel` import it so there is exactly one renderer.
- The Reasoning panel uses that same component everywhere it currently prints text: Expected line, Student line, floating-number chips, student-introduced terms, and the Check verdict's echoed expression.
- Result: whatever structure the orange line shows in normal mode is mirrored character-for-character in the panel; no `\frac`, `^{}`, `_{}` can reach the screen.

### 2. Expected line = the teacher's orange equation
- Add `equationAscii` to the panel's `KeyLine` type and prefer it over `tokens.join(" ")`, falling back to tokens only for legacy answer keys.
- Pass the value through the existing display gate (`assertDisplaySafe` / `stripLatexScaffolding`) before rendering, so even a legacy token string cannot leak scaffolding.

### 3. Line viewer: always visible, side scrollbar, never clipped
- Expected line becomes a pinned block: it sticks to the top of the panel's scroll area so it stays on screen while the teacher scrolls the rest of the panel.
- Expected line and Student line each get their own bounded viewer with a scrollbar **on the side of the block** (a dedicated vertical scroll track outside the math area, not overlaying the expression), so tall content (stacked fractions, nested powers) can be scrolled through in full without shrinking the math.
- Content wraps rather than truncating: long expressions wrap onto further lines inside the viewer, and the viewer grows to a comfortable max height before scrolling starts.
- Student line keeps its `row N` badge; the scroll position resets whenever the active line or question changes.

### 4. Verification
- Add a rendering test asserting the Reasoning panel's Expected line, Student line and chips contain no `\frac` / `\sqrt` / `^{` / `_{` text nodes for a LaTeX-bearing answer key.
- Run typecheck plus the existing smartboard/reasoning suites.

## Technical notes
Files touched: new `src/components/smartboard/PresenterMath.tsx`; `src/components/smartboard/TeacherReasoningPanel.tsx`; `src/components/smartboard/PresenterPreviewPanel.tsx` (import the shared renderer); one new test. No database or edge-function change — `equationAscii` is already stored and already read by `grade-line`.
