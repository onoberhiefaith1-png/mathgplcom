# Autoplay: Wipe Board + Actually Click the # Button

Two focused fixes.

---

## 1. Wipe the Smartboard on Autoplay start

Right now Autoplay begins on top of whatever ink the teacher/student already had on the board, so leftover work confuses the AI's row-signature checks. The teacher's request: Autoplay must start from a blank surface.

**Change** — `PresentationView.tsx` exposes a `resetBoard()` on the `PresentationController`. `usePresentationAI.start()` calls it before the first step. `resetBoard()` performs the same reset the existing "Clear board" toolbar button already runs:

- `setFreeLines({})`
- `lineWidthsRef.current = {}`
- `setSensor({ line: 0, x: 0 })`
- `setLiveCursor({ path: [], index: 0 })`
- Clear PAI-owned reveal state: `setShownNotebookIdx(new Set())`, `setNotebookAttentionIdx(new Set())`, `setConsumedAbsIdx(new Set())`
- `rowOwnersRef.current = {}`

It does **not** touch reservoirs, plan, or lesson content.

## 2. Teach the AI to actually click the # (Floating Number) button

The error in the screenshot — `Floating Number 1 did not land on the Smartboard. Expected +5x. writeEquationPrefix did not commit the row.` — happens because the current `pickFloatingNumber` still goes through `writeProseLineOnBoard(fillers.join(" "))`. That helper is designed for full prose/equation lines and refuses to commit chip fragments like `+5x` (leading operator, no left-hand side), so the row stays empty and the inspector flags it.

The real UI already has the exact path a teacher uses:

- `AssistantButtons` → **Numbers (#)** — sets `activeAssistant = "numbers"`, which mounts `FloatingNumberPanel`.
- `FloatingNumberPanel` → chip click → `onInsert(text)` → `insertTextAtSensor(text)` (and `onInsertFrac` for fractions) → `setConsumedAbsIdx.add(absIdx)`.

The AI must drive that exact path.

### Controller additions in `PresentationView.tsx`

- `openFloatingPanel()` → `setActiveAssistant("numbers")` and point the panel at the target reservoir/line via `setManualFloatingLineIdx(lineIdx)` + `setFloatingLineIdx(lineIdx)`.
- `closeFloatingPanel()` → `setActiveAssistant(null)`.
- `isFloatingPanelOpen()` → `activeAssistant === "numbers"`.
- `moveSensorToLineStart(lineIdx)` → set the writing sensor to the leftmost column of the row currently owned by `lineIdx` (via `rowOwnersRef`); if the line has no owner yet, seat the sensor on the first empty row below the last owned row.
- `pickFloatingNumber(lineIdx, fillerIdx)` — the teacher-style path:
  1. If the panel isn't open, `openFloatingPanel()`.
  2. `moveSensorToLineStart(lineIdx)` (only if the sensor isn't already on that row — never disrupt an in-progress line).
  3. Read `filler = guidedLines[lineIdx].fillers[fillerIdx]`.
  4. If the filler is a fraction chip (matches `^[+\-−]?\d+\/\d+[a-zA-Z]?$`), call `insertFractionAtSensor({sign, num, den})`; otherwise call `insertTextAtSensor(filler)`.
  5. Compute the reservoir-flat `absIdx` for that chip and `setConsumedAbsIdx.add(absIdx)` so the panel greys the chip out the same way it would under a manual click.

The AI hook (`usePresentationAI.ts`) `applyStep` for `kind === "filler"` calls `ctrl.pickFloatingNumber(lineIdx, fillerIdx)` instead of `writeEquationPrefix`. `line-verify` still calls `writeEquationPrefix` as a belt-and-braces final assertion (idempotent by row signature).

### AbsIdx mapping

`FloatingNumberPanel` numbers chips per reservoir. The mapping is:

```text
absIdx(lineIdx, fillerIdx) =
  sum(reservoir.lines[k].fillers.length for k in 0..lineIdx-1) + fillerIdx
```

`resolveFloatingAbsIdx(lineIdx, fillerIdx)` will live in `PresentationView.tsx` next to the other PAI helpers and be used by `pickFloatingNumber`.

### Inspector wording

The `filler-missing` message now reads: `Floating Number k for line L was not placed. The AI must open the # panel and click the chip for "<filler>".` Repair recipe becomes:

1. `openFloatingPanel()`
2. `moveSensorToLineStart(lineIdx)`
3. `pickFloatingNumber(lineIdx, fillerIdx)`
4. Re-inspect the row signature; success when it matches the expected prefix.

## Files touched

- `src/lib/smartboard/presentationAI/controller.ts` — extend interface (`resetBoard`, `moveSensorToLineStart`, richer `pickFloatingNumber`).
- `src/components/smartboard/PresentationView.tsx` — implement `resetBoard`, real `openFloatingPanel`/`closeFloatingPanel`, `moveSensorToLineStart`, teacher-style `pickFloatingNumber`, `resolveFloatingAbsIdx`.
- `src/hooks/usePresentationAI.ts` — call `ctrl.resetBoard()` in `start()`; route `filler` step through `pickFloatingNumber`; route `note` step through `openFloatingPanel(false)` before `writeProseLineOnBoard` so the note lands on a clean surface.
- `src/lib/smartboard/presentationAI/repairs.ts` — `filler-missing` recipe drives the panel + chip click sequence.
- `src/lib/smartboard/presentationAI/inspector.ts` — updated messages to name the tool the AI must use.

## Success criteria

- Pressing Autoplay wipes any existing ink and starts on a blank Smartboard.
- The Numbers (#) assistant panel visibly opens as the AI reaches each filler step; chips grey out one by one as the AI picks them.
- The Line 1 `+5x` case in the screenshot commits to the board on the first attempt — no red diagnosis.
- Teacher Notes still land after the fillers (existing `note-missing-on-board` check remains in place).
- Nothing changes about how fillers or notes are authored in the Presenter Preview.
