# Subcells, Advance and Calculate — finishing the table workflow

Builds on the Subcell work already done (Lesson Note Add/Edit/Remove Subcell, Row | Column | Subcell on the Generation page). Row, Column, Generate, Add Line, Retention, Summation, Floating Numbers and marking stay exactly as they are.

Acceptance test throughout: the football-goals example (x, f, fx, x², fx² with calculations such as `4 × 2`, `2²`, `4 × 4`). The first, data-only table (x, f) never gets Subcells.

## 1. Advance toggle (Lesson Note and Smartboard)
- An **Advance** button on every table that has Subcells. One table with a layer you can show or hide, never a second table.
- **On (default for new notes):** each row shows a working area above a blue line and the answer below it. Cells with no calculation (x, f) show an empty area above the blue line.
- **Off:** blue lines, working areas and expressions are hidden, leaving the plain table. The working is kept and comes back when Advance is turned on again.
- The on/off state is saved with the table, and the student board starts in the same state the teacher left it in.

## 2. Student board: active Subcell and Calculate
- **Advance off:** clicking a cell uses the existing Row/Column Floating Numbers, exactly as today.
- **Advance on:** clicking a Subcell makes it the only active one, with a soft blue tint, and shows only that Subcell's Floating Numbers.
- **Calculate** works out only the active Subcell. The result replaces the old answer (for example 8 becomes 16), the working stays visible, and the existing instant marking checks the new answer.
- The working is saved with the attempt so teachers see it in View Student Work. Marks still come only from the answer.

## 3. Live table growth and phones
- A long calculation widens its whole column and heightens its whole row. Other rows and columns keep their size, and nothing is cut off.
- **Phones:** the table stays a real table that you swipe sideways inside its own area. The page around it and the Floating Numbers do not move.

## 4. Copilot writes the Subcells
- When Copilot builds a calculated table, it fills in the working for the calculated columns, for example `f × x` for fx, `x²` and `f × x²` for fx².
- Copied data columns get no working.
- Each calculation is checked against its answer. If they don't match, that working is left out rather than shown wrong. The answers themselves never change.
- Subcells Copilot writes and Subcells a teacher adds by hand look and behave the same.

## 5. Academia refinements (from the third document) — separate follow-up
School Academia profile, a left-hand menu you can collapse, real Session names (never "Session 1"), the redesigned Session page, AI video thumbnails and side-scrolling question cards. I'll plan these on their own after the table work, so the two don't get mixed up.

## Technical details
- `SmartTableAttrs.advanced: boolean` (default true when subcells exist). The renderer always reserves the upper area per row when on; CSS grid/table-layout auto keeps column and row growth uniform.
- Student board: presentation rows carry `subcells` + `advanced`. The active Subcell key lives in board state. Calculate evaluates the built tokens with `evaluator.ts` / the math engine, writes into the answer filler and calls the existing instant-grade path. The working is stored additively on the attempt payload.
- Mobile: the table sits in an `overflow-x-auto` container with `touch-action: pan-x`, kept separate from the Floating Numbers dock.
- `notebook-ai`: the table schema gains an optional `subcells` map. A verify-or-drop pass uses `tryEvaluate`. The QUESTION_LOCK rule is unchanged.
- Tests: Advance round-trip, Calculate replacing the answer, the football example's Copilot Subcells, and Row/Column regression checks.
