# Fix Game marking, first-line note and long-line wrapping

## Problems seen
1. A correct student line is shown as "keep going, close the bracket" even though every bracket is closed. The student's extra brackets (e.g. `(-2)^2`, `((...))`) confuse the reader of the line, so the mark is blocked.
2. Marking looks only at the typed student line. It should judge from three sources together: the student line, the predicted line and the student's actual work on the board.
3. When line 1 of a solution is a note, the note does not appear by default. The question sits on line 0, so the note should sit on line 1 straight away, before any click.
4. Long lines run off the right edge of the writing page instead of wrapping onto the next line.

## What will change
- **Bracket reader:** redundant or nested brackets, `±`, `√` and brackets around negative numbers are read correctly. "Close the bracket" appears only when a bracket is genuinely left open.
- **Three-source judgement:** a line is awarded when any trustworthy source proves it equivalent to the expected line: the student line, the predicted line when it is complete, or the ink read straight from the board. A line is marked wrong only when all available sources agree it is wrong. An incomplete verdict never overrides a proven one.
- **Same rules in both engines:** the Floating Number engine and the Present Mode engine use one shared marking decision, so they always give the same result.
- **Note on line 1:** when a solution's first step is a note, it is written on line 1 as soon as the question opens. Line numbering is unchanged: question on 0, note on 1, working from 2.
- **Wrapping:** when writing reaches the edge of the page, the text breaks at a word or operator and continues on the next line, so all of it stays on screen. Tall pieces such as fractions are never split.

## How it will be checked
- Tests using your quadratic example: `x = (-(-2) ± √((-2)^2 - 4(5)(-4))) / (2(5))` must be Equivalent with full marks, with and without extra brackets.
- A genuinely unclosed bracket must still say "close the bracket".
- Tests that both engines return the same verdict.
- A browser check of the game page: note on line 1, long question wrapped inside the page.

## Technical details
- `src/lib/math/structure.ts`: fix the parser so balanced redundant groups do not raise `Incomplete("close the bracket")`; strip redundant parens before checking.
- New `src/lib/smartboard/combinedVerdict.ts`: takes student ascii, predicted line, board-ink ascii and returns one verdict. Used by `useGameRuntime.ts`, `instantAward.ts`, `TeacherEvaluationPanel.tsx`, `PresentationView.tsx`.
- `supabase/functions/grade-line/index.ts` and `_shared/lineDiagnosis.ts`: accept optional `predictedAscii` / `boardAscii` and award if any is equivalent via `mathEquivalence.ts`.
- `floatingEngine` / `presentEngine`: on question start, write the line-0 question and, if solution line 0 is a note, commit it at row 1 through `planDirectWrite`.
- `FreeWriteLayer.tsx` / `directWrite.ts`: measure line width against the page width and split overflowing rows into continuation rows that the ledger marks as owned by the same line.
