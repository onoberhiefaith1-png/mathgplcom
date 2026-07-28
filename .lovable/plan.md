## Root cause (confirmed)

I read the student's live board record for this assessment. The board tree for the active row is:

```text
x = frac( box( box( −b ± sqrt(b² − 4ac ...) ) ) , 2a )
```

The Smartboard renderer draws every node kind, including `box` (the outlined cell used by the fraction/box workflow). The shared flattener `nodeToAscii` in `src/lib/smartboard/rowAscii.ts` has cases for `char, frac, sqrt, power, sup, sub, subsup, bracket, bigop, accent, binom, matrix` — but **no case for `box`**. A `box` node therefore flattens to nothing, so the whole numerator vanishes and the Reasoning panel (and the grader, which uses the same string) sees `x=()/2a`.

So the Student Line is not being rebuilt from floating numbers or re-parsed — it already comes from the same live object as the board. The one live object simply has a lossy translation step.

## Changes

### 1. One lossless flattening of the live math object
`src/lib/smartboard/rowAscii.ts`
- Add a `box` case: a box is a transparent container — emit its body row verbatim (empty box → empty string, so a genuinely empty slot stays empty).
- Make the switch exhaustive with a `never` check so any future node kind fails typecheck instead of silently deleting maths.
- Same fix mirrored in the edge-side flattener if one exists under `supabase/functions/_shared` (checked during implementation).

Effect: Smartboard, Student Line, Teacher live board and the `grade-line` grader all receive identical text, since they all already read this one function. Regression test added: box-wrapped numerator round-trips to `(−b±sqrt(b²−4ac))/(2a)`.

### 2. Expected Line comes only from the authored equation
`src/components/smartboard/TeacherReasoningPanel.tsx`
- Keep `equationAscii` (the teacher's orange normal-mode line) as the sole source. Verified the answer key for this assessment stores it (e.g. `x² + 5x + 6 = 0`).
- Remove the fallback that joins the floating-number tokens into a pseudo-equation; when no authored equation exists, show "no authored equation for this line" instead of a reconstruction.

### 3. Dynamic box behaviour
`LineViewer` in `TeacherReasoningPanel.tsx`
- Remove the `maxHeight: 9.5rem` cap and inner vertical scroller: boxes grow downward without limit and the sections below simply move down (the panel's own scrollbar already handles the page).
- Fixed width, no crop, no overflow, no reflow of the maths: measure the rendered expression against the container and apply a single uniform `transform: scale(k)` (with `transform-origin: left top` and matching reserved height) so an over-wide equation shrinks until it fits. Re-measured on content change and on container resize (`ResizeObserver`), with a sensible minimum scale.

### 4. Dedicated Reasoning full screen
- Add a second icon button beside the "Reasoning" title in the panel header (expand / collapse), reporting the state up via a new optional `onToggleFullscreen` / `fullscreen` prop.
- `src/pages/class/TeacherAssessmentViewerPage.tsx`: when active, hide the Smartboard column and let the Reasoning panel fill the window (all sections intact). The Smartboard stays mounted but visually hidden so the live realtime subscription, board feed and evaluation keep running uninterrupted.
- The existing Smartboard full-screen button is untouched.

### Verification
- Unit test for the box-node flattening plus the existing reasoning/answer-key suites.
- Manual pass in the preview on this student's board: confirm the Student Line renders `x = (−b ± √(b² − 4ac)) / 2a` identically to the board, the Expected Line renders the authored equation, a deliberately long expression scales down inside a fixed-width box, and Reasoning full screen keeps updating live.
