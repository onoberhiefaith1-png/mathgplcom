## Goal

Presentation AI must reconstruct the lesson exactly as the Presenter Preview specifies — same equation, same order, in a clean row — using the same physical smartboard tools a teacher uses (# panel, eraser, sensor up/down, scroll, prev/next). The Presenter Preview is the single source of truth; every diagnosis compares board state against it.

## Problems in the current run

1. **Wrong "Expected" text in the diagnosis.** For Example 1 · Line 1 the panel showed `Expected +5x =0` while the actual line in the Presenter Preview is `2x² + 5x + 3 = 0`. The inspector builds `expected` by joining `fillers[0..k]` in reservoir order, so if the reservoir chip order is `+5x, =0, 2x², +3` the AI ends up "expecting" a scrambled prefix. On top of that, Line 1 is the question line and should not be reconstructed chip-by-chip in the first place.
2. **Floating Number 2 did not land.** Chip was picked but the target row was off-screen / occupied, so the write silently failed. The AI never scrolled the board and never moved the writing sensor to a safe row.
3. **Sensor collides with content above.** When the previous row is a fraction (numerator/denominator), writing on the next visual row overlaps the denominator. The AI must move the sensor down to the first clear row.
4. **No self-correction with the eraser.** When the AI writes on the wrong row or produces garbled ink, it must erase and rewrite instead of stacking more ink.
5. **No explicit "follow the Preview" contract.** The step loop performs actions but does not verify against the Preview line text; it verifies against a derived signature that can silently disagree with the visible equation.

## Fix plan

### 1. Preview-as-truth for line composition

- In `presentation.ts`, when building fillers for the first (question) line of a section, mark the line as `notebookOnly`-style **question line** (new flag `isQuestion: true`). The AI writes such lines wholesale via `writeProseLineOnBoard(line.equation)` — no chip-picking, no filler substeps.
- For solution lines, sort/validate chip order so that concatenating fillers reproduces `line.equation` left-to-right. Add a `normalizeFillerOrder(equation, fillers)` helper that sorts chips by their first occurrence index in the equation string. If a chip cannot be located in the equation, log a `filler-order-broken` structural issue rather than silently mis-ordering.
- `inspector.ts` computes `expected` for a filler step as `equation.slice(0, endOfChipK)` — the actual prefix of the equation string — not `fillers.slice(0,k).join(" ")`. This is what the teacher sees on the Preview.

### 2. Sensor up / down + safe row selection

Extend `PresentationController`:

```ts
moveSensorUp: (rows?: number) => void;
moveSensorDown: (rows?: number) => void;
moveSensorToSafeRow: (lineIdx: number) => number; // returns chosen row
getRowOccupancy: (row: number) => "empty" | "ink" | "note" | "fraction-denominator";
```

In `PresentationView.tsx` implement `moveSensorToSafeRow`:
1. Start at the row currently claimed by `rowOwnersRef` for `lineIdx`, else the row just below the last owned row.
2. Walk downward while `getRowOccupancy(row)` is anything other than `empty` — treat `fraction-denominator` as blocking one extra row of clearance so descenders don't collide.
3. Claim the row in `rowOwnersRef` and set `sensor` there before any chip write.

`applyStep` calls `moveSensorToSafeRow(lineIdx)` at the start of every `line-start` and re-checks before each `filler` write.

### 3. Scroll to keep the target row in view

- `scrollBoardTo(lineIdx)` (already stubbed) fully implemented: compute pixel-y of the row from `sensor.rowHeight * row` and call `boardScrollRef.current.scrollTo({ top, behavior: "smooth" })`, keeping a 120 px top margin below the `Solution` header.
- Called by `applyStep` before every filler / note write, and by the `filler-missing` and `note-missing-on-board` repair recipes before retrying.

### 4. Eraser as a first-class tool

- `PresentationController.eraseRow(row: number)` and `eraseNoteAt(lineIdx)` (upgrade the current stub): wipe `freeLines[row]`, `lineWidths[row]`, and clear the row from `rowOwnersRef`.
- New repair path shared by `line-mismatch`, `filler-missing` (after two failed picks), and `note-missing-on-board`:
  1. `scrollBoardTo(lineIdx)`
  2. `eraseRow(currentRow)`
  3. `moveSensorToSafeRow(lineIdx)`
  4. Retry the write (`pickFloatingNumber` or `writeProseLineOnBoard`).
- Guard: the eraser only ever touches rows currently owned by `lineIdx` — never a sibling line's row.

### 5. Explicit smartboard operating procedure (the AI's "manual")

Extend `interface.ts` with a `SMARTBOARD_PROCEDURE` array — the ordered rules the AI follows for every solution line. This is documentation embedded in code so future edits keep the contract visible:

```text
1. Read the target line from Presenter Preview (equation + fillers, in Preview order).
2. Scroll the smartboard so the target row is visible below "Solution".
3. Ask moveSensorToSafeRow(lineIdx). If the row above is a fraction denominator, drop one extra row.
4. If this is the question line (isQuestion), write it whole via writeProseLineOnBoard — do NOT open the # panel.
5. Otherwise open the # (Floating Number) panel with openFloatingPanel(lineIdx).
6. For each filler chip in Preview order: pickFloatingNumber(lineIdx, k). Verify the row prefix equals equation.slice(0, endOfChipK). If it does not, erase the row and retry once, then raise filler-missing.
7. If the line has a Teacher Note, close the # panel, scroll, place sensor, writeProseLineOnBoard(note), mark shown.
8. line-verify: compare board row signature to equation signature. On mismatch, eraseRow + rewrite once, else raise line-mismatch.
9. On any AI mistake, use the eraser on the AI's own row only — never a sibling row.
10. Prev/Next chapter buttons are used only when the beat cursor drifts (repair path for beat-cursor-drift).
```

The inspector references this procedure by rule number in `suggestedFix`, so the diagnosis panel reads like a teacher instruction ("Rule 3: move sensor down past the denominator").

### 6. New / updated issue kinds

Add to `types.ts`:
- `sensor-collision` — target row is occupied or would overlap a fraction.
- `filler-order-broken` — reservoir chip order does not reconstruct the equation.
- `board-scroll-lost` — target row is out of viewport at write time.

Each has a dedicated repair recipe (move sensor / re-sort chips / scroll) in `repairs.ts`.

## Files to edit

| File | Change |
| --- | --- |
| `src/lib/smartboard/presentation.ts` | `isQuestion` flag on the first line; `normalizeFillerOrder`. |
| `src/lib/smartboard/presentationAI/types.ts` | New `IssueKind`s. |
| `src/lib/smartboard/presentationAI/interface.ts` | `SMARTBOARD_PROCEDURE` doc + tool ids for eraser / sensor / scroll. |
| `src/lib/smartboard/presentationAI/controller.ts` | Add sensor / eraser / scroll / occupancy methods. |
| `src/lib/smartboard/presentationAI/inspector.ts` | Use equation-prefix as `expected`; emit new issue kinds; skip filler substeps for question lines. |
| `src/lib/smartboard/presentationAI/repairs.ts` | Erase-and-rewrite recipe; scroll + sensor recipes. |
| `src/hooks/usePresentationAI.ts` | `applyStep` calls scroll + sensor before every write; question line uses `writeProseLineOnBoard`. |
| `src/components/smartboard/PresentationView.tsx` | Implement `moveSensorToSafeRow`, `moveSensorUp/Down`, `scrollBoardTo`, `eraseRow`, `getRowOccupancy`. |

## Success criteria

- Autoplay on the current lesson writes `2x² + 5x + 3 = 0` on Line 1 whole (no chip picking) and the diagnosis panel's `Expected` matches that exact string.
- Floating Number 2 lands on-screen because the AI scrolls and drops the sensor to a safe row before the pick.
- When a fraction sits above the target row, the sensor moves an extra row down and no ink overlaps.
- If a chip lands on the wrong row, the AI erases that row and retries once before raising `filler-missing`.
- The `suggestedFix` text in every diagnosis references a numbered rule from `SMARTBOARD_PROCEDURE`.
