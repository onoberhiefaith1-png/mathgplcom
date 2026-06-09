# Classwork board: structure icon, line-check, and structure source

Three fixes to the student classwork board (assessment mode), all reusing the existing board.

## 1. Move the structure icon up so it stops overlapping "Check line"

The structure tools panel and the "Check line" button currently sit in the same bottom-right corner, so the structure icon is hard to tap.

- In `PresentationView.tsx`, give the `StructurePanel` its own default vertical position in assessment mode, raised about 1.5 line-heights above the shared `defaultY` (where the floating-number strip sits). This lifts it clear of the fixed bottom-right "Check line" button.
- The structure panel stays vertically draggable, so the student can still move it afterward; this only changes where it first appears.
- No other icon shares that lane (floating numbers sit on the left), so nothing else collides.

## 2. Make "Check line" recognize the completed line — and grade it with AI

Two problems are stacked here.

**a. The line is never found.** Today `checkActiveLine` reads only the one exact physical row `bandStart + activeLineIdx`. If the student's line landed on any other row, it reports "Build this line on the board, then tap Check" and never calls the grader.

Fix: scan the active band for the student's written rows in top-to-bottom order and map the *k*-th non-empty completed row to guided line *k*. When checking line N, grab the N-th written line instead of demanding one fixed row. This is what actually made it "not recognize" the completed line.

**b. Grading is too literal.** The server currently only does an exact chip-multiset comparison. We add AI as the smart checker the user asked for.

- Send the student's full line text (ascii equation) to `grade-assessment` alongside the existing chip `arrangement`.
- Server flow becomes: run the fast multiset check first (cheap, instant). If that does not match, call Lovable AI as a second opinion to decide whether the student's line is mathematically equivalent to the hidden correct line.
- The AI is given an explicit, locked rule: compare ONLY the student's line against the stored correct line for this exact question; reply strictly correct / not-correct; never invent a different equation; equivalent rearrangements and side-swaps count as correct, moving a term across "=" does not. This mirrors the QUESTION_LOCK / answer-key security model — the answer key never leaves the server.
- Marks, score, solved-lines, and progress writes stay exactly as they are; only the correct/incorrect decision gains the AI fallback.

This keeps grading server-authoritative and the answer key hidden, while making the check forgiving enough to recognize a genuinely correct line.

## 3. Structure icon must match the teacher's lesson note

In assessment mode every line is currently built with `containers: []`, so the structure panel only ever shows the generic box — never the fraction/root/power structures the teacher used.

- In `createAssessment.ts`, carry each floating line's `containers` (the structures from the lesson note) into the question payload stored on the assessment.
- In `assessmentBoardSource.ts`, populate each `ReservoirLine.containers` from that payload instead of `[]`.
- The existing `requiredStructures` logic then surfaces exactly the structures the teacher's lesson note generated for each line. No answer content is exposed — structure kinds (fraction, root, power, …) are not the answer.

## Technical notes

- Files: `src/components/smartboard/PresentationView.tsx` (structure default Y + robust line lookup + send ascii), `supabase/functions/grade-assessment/index.ts` (AI fallback, new optional `studentAscii` field), `src/lib/assessments/createAssessment.ts` and `src/lib/assessments/assessmentBoardSource.ts` (carry/populate `containers`).
- AI uses the Lovable AI gateway with `LOVABLE_API_KEY` (already configured); default model `google/gemini-3-flash-preview`. Gateway 429/402 errors fall back to the multiset result so a credit/rate issue never blocks a correct student.
- Existing assessments created before this change won't have stored `containers`; they keep showing the generic box until regenerated. New classwork picks up structures immediately.
