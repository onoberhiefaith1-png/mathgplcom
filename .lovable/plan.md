# Nested structures + Smartboard structural navigation

Goal: `√(y/6) + 8/8` (and any recursive combination) must be buildable entirely on the board — enter a structure, edit every slot, leave it, continue beside it.

## What the code already has (verified)

- `src/lib/smartboard/mathTree.ts` is already a real tree (`Row`/`Node`, `rows: Row[]` slots). Nothing is flattened to text. Fractions, radicals, brackets, matrices, powers, big-ops all expose independent slots.
- `moveLeft`/`moveRight` already descend into and hop out of containers; `moveUp`/`moveDown`/`exitContainerRight` exist; `verticalSlot` maps frac/sqrt/power/subsup/bigop/matrix slots.
- `MathTreeRender.tsx` already renders per-slot pointer targets: an inter-node tap zone, a trailing tap zone, `RightEscape` after most containers, and clickable empty placeholder slots.

So the model is compositional already. What is unverified is *why* the denominator inside a radical cannot be activated in the running app, and why there is no reachable insertion point after the radical. That is the first step below, not an assumption.

## Step 1 — Reproduce with instrumentation (no behaviour change yet)

Drive the board in a headless browser: insert `√`, insert a fraction inside it, type `y`, then attempt (a) click the denominator slot, (b) press ▼, (c) press ▶ repeatedly, logging the live cursor path after each action. This tells us exactly which of the three suspects is real:

1. the click never reaches the slot (an overlay above `FreeWriteLayer`, or the click gate in `PresentationView` around line 5932 rejecting the row),
2. the click lands but a later effect snaps the caret back to `{path: [], index: 0}`,
3. the caret is correct but the write path re-derives its own position (`editActive` relocation, or `exitCompletedScriptCursor` popping out of the structure before insertion).

## Step 2 — Fix the navigation model (structure-first, recursive)

- `moveDown` currently gives up at the innermost structure. Make both `moveUp` and `moveDown` walk *outward* through enclosing structures until a vertical slot exists, and only then report "no vertical target" so the caller changes board row. Numerator→denominator inside a radical inside a matrix cell must work at every depth.
- The D-pad handlers (`nudgeCursor`, `nudgeCursorHoriz`) must try structural movement before any board-row/offset logic, and must not be short-circuited by band/layout guards while the caret is inside a structure. `canCursorUp/Down/Left/Right` must be live whenever the caret is inside a structure.
- ▶ from the last slot of a structure must always land on the "after the structure" position (`exitContainerRight` semantics), never leave the caret stuck at the slot end.

## Step 3 — Reliable insertion zones between structures

- Give every container a left entry zone as well as the existing `RightEscape`, and widen both to a comfortable hit area (kept as zero-layout overlays so spacing is unchanged) so tapping just after a radical activates the outside position rather than the radicand.
- Ensure containers that currently lack `RightEscape` (sqrt index, sup/sub, matrix, bracket variants) get the same exit affordance.
- Keep visual geometry as-is: the radical still draws only around its own content; hit areas overlay, they don't push layout.

## Step 4 — Fix the write path so writing follows the caret

- Structural inserts and character inserts must use the live cursor path verbatim. Remove/limit `exitCompletedScriptCursor` to the script case it was written for so it can never pop the caret out of a fraction/radical before a keystroke.
- Clicks on a nested slot of a writable row must be accepted by the click gate on the sensor's own row, and must not be re-snapped by the line-sync effects.
- Floating Number chip insertion follows the same rule: a chip inserted while the caret is in a slot lands in that slot.

## Step 5 — Regression + composition tests

Extend `src/lib/smartboard/__tests__/` with cursor-only construction tests (no special-casing of sqrt+frac):

- fraction alone; radical alone; radical expansion; matrix cells.
- fraction in radical, radical in fraction, fraction in bracket, matrix in bracket, fraction/radical inside a matrix cell, bracket inside a fraction.
- the mandatory case `√(y/6) + 8/8`, asserting the second fraction is a top-level sibling of the radical, not inside it.
- `√((x+1)/6) + [A] + B` remains fully addressable.

Then run the full smartboard test suite plus typecheck, and re-verify in the browser that the 13-step teacher workflow completes without copying or external editing.

## Scope guarantees

No redesign, no flattening, no new editor. Changes are confined to `mathTree.ts` navigation, `MathTreeRender.tsx` hit zones, and the cursor/write wiring in `PresentationView.tsx`, plus tests. Existing lesson-note rendering, matrix behaviour and radical expansion are preserved.
