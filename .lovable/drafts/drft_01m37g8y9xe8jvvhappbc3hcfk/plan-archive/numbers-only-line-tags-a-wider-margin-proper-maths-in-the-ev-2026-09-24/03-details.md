## Technical details
- `SlateColumn.tsx`: `LineTag` renders `{index}` in place of `` `Line ${index}` ``. Shrink `tagGutter` in `layout.ts` to fit two digits, and lower the margin clamp minimum to match. Update the layout tests.
- `GameEvaluationPanel.tsx`: render Expected/Student through the shared structured-math renderer (LaTeX → KaTeX; ascii with `□` placeholders → formatted), with a readable-text fallback. Remove `font-mono` raw output.
- `GamePlayPage.tsx`: when `lineReport` status is equivalent (from the same `predict(...).complete` / verdict used for the label) and the line isn't yet in `completedLines`, call `runtime.onLineAward({ questionId, lineId, studentAscii, marks })` in an effect. The existing `awarded` set in `useGameRuntime.acceptLineAward` guarantees it only pays once, so the board's later `lastAwardedLineId` or grading reconcile becomes a no-op.
- `rewardMayFire` stays gated on `completedLines`; that list now fills straight away, so rewards, notes and sounds fire in the same tick.
- Tests: an equivalent line awards without changing line, pays once only, a non-equivalent line never pays, and tag width shrinks while the margin stays after the tag.
- Verify in Test Play with `2(x + 3) − 4x = 8`: the coin, mark and note appear without moving to the next line.
