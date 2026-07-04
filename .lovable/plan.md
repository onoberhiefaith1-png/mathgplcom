## Root cause

Two independent bugs are producing the "auto-solution on down" behavior at line 12+:

**Bug A — Notes containing math-shaped equations still render.**
When prose is captured between highlight A and highlight B, `recomputeNotebooks` (in `FloatingPreparationPage.tsx`) stores every unhighlighted token as prose on A. If the teacher forgot to highlight an equation on a later row, that equation gets saved as A's `precedingNotebook`. The current guard in `PresentationView.tsx` only rejects a note when it contains **2+ equation-shaped lines**. A single equation-shaped line (like `x₂ = -5 - 1 / 4`) slips through and renders as A's note. Because the note-reveal flow calls `writeProseLineOnBoard` (Read → writes prose onto the board), pressing the reveal chevron writes that equation to the board — which looks exactly like "the solution appeared by itself." This is not a size limit ("first 10 lines") — it's a **content shape** bug that only bites once a phantom-equation-note occurs, which happens deep in the solution where users tend to forget a highlight.

**Bug B — Line 13+ are not clickable because they were never highlighted.**
`guidedLines` is built strictly from `floating_highlights`. If the teacher didn't highlight line 13 in the Lesson Note, no reservoir line exists for it, so `stepTo` and the row-tap targeting refuse to jump there. The teacher perceives this as "unclickable rows." Also, the reveal-notebook button writes the phantom equation, giving the illusion of auto-solving.

Both issues must be fixed as **universal laws** (no line-count assumptions).

## Plan

### 1. Universal "notebook must be prose" law — enforced in TWO places

Any string that contains **any** math-shaped line must be excluded from `precedingNotebook`. A line is math-shaped when it holds `= + − × ÷ / ^` operators or is nearly all digits/punctuation (mirror the existing `looksLikeMath` detector from `parseSolutionExplanations`).

- **`src/pages/FloatingPreparationPage.tsx` (write-side)** — inside `recomputeNotebooks`, after building each `precedingNotebook` chunk, split by newline, drop every line that `looksLikeMath`, and rejoin. This prevents a stray equation from ever being saved as a note, regardless of how far down the lesson the teacher went.
- **`src/components/smartboard/PresentationView.tsx` (read-side)** — tighten `notebookFor(k)`: reject the note if **any** line looks like math (change the current `>= 2` to `>= 1`). A single equation-line note is never legitimate.

### 2. Down button never writes — sensor only

Audit every "down" entry point so none can emit text on the board:

- `onNextLine` (FloatingNumberPanel chevron): must never call `writeProseLineOnBoard`, insert chips, or advance the beat. It only calls `stepTo(cur+1)` after cleaning any phantom notebook state.
- D-pad ▼ and `ArrowDown`: only invoke `nextSensorRowBelow` / row navigation. Remove any branch that would auto-insert a fragment.
- Reveal-notebook write path (`writeProseLineOnBoard`) is only reachable through the explicit "Read" button, never as a side effect of down-press.

Because Bug A vanishes once phantom equation-notes stop existing, the "pressing down auto-solves" symptom disappears with Bug A's fix. Step 2 exists to guarantee the invariant even if a future note squeaks through.

### 3. Universal (unbounded) test coverage

New test `src/test/notePurityLaw.test.ts`:

- Build a reservoir with **50** highlighted lines, injecting an unhighlighted equation-shaped fragment between lines 12/13, 27/28, and 44/45.
- Assert `notebookFor(k)` returns `""` for every one of those three lines.
- Assert every non-affected line's notebook still shows when it is genuine prose.
- Add a parallel test asserting `recomputeNotebooks` never saves an equation-shaped line inside `precedingNotebook` — even at index 30+.

## Files touched

- `src/pages/FloatingPreparationPage.tsx` — filter math-shaped lines out of `precedingNotebook` in `recomputeNotebooks`.
- `src/components/smartboard/PresentationView.tsx` — tighten `notebookFor` to reject any equation-shaped line; audit down-press handlers to ensure zero write paths.
- `src/test/notePurityLaw.test.ts` — new universal test (50+ lines) validating both write-side and read-side.

## Rule (final, universal)

> A "note" is prose. If any line in a highlight's `precedingNotebook` matches the math-shape detector, that line is dropped at save time and rejected at render time. The down control only moves the sensor and advances line index; it never writes to the board. This law is line-count-independent — it holds for line 1, line 12, or line 1,000,000.