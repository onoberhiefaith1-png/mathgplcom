# Instant score the moment equivalence is proved — no "Score pending"

## What is happening now (checked)

- The Predictive Line already proves the line complete locally: in your screenshot Expected, Student and Predictive lines all read `x + 7 = 12` and the panel says "Equivalent detected".
- But the mark is not handed out by that proof. The proof only runs *inside* the marking request path (`gradeLineThroughEngine`), which is triggered by the delayed grading tick. Until that tick runs and the award reaches the Game, the panel shows the inconsistency warning "Equivalent detected / Score pending" and the score bar stays `0 / 6`.
- The Game computes its own Predictive Line for the panel only. It deliberately never marks: it waits for the board's award event. So a proof that lands in the Game is currently a display, not a score.

So the gap is not mathematics. Equivalence is already known instantly; the *award* still travels the slow path.

## The rule (unchanged)

No equivalence, no mark. Ever. What changes is only the speed of the mark once equivalence is proved.

## Build

1. **Award on the same tick as the proof.**
   Move the predictive proof out of the marking-request path into the line-input path, so it runs the instant the student's line text changes — no delay, no network. When the proof says the line is complete and equivalent:
   - record the line's marks immediately,
   - publish the award event with the exact working that earned it,
   - update the score bar at the top in the same update.
   The marking service request then fires in the background for the record only.

2. **One shared instant-award helper.**
   A single small module owns "proof → award payload" (line id, marks, exact expression, reason `predictive_equal`) so the board and the Game consume identical events and no second mathematical engine appears.

3. **Game receives it instantly.**
   The Game keeps its rule of never grading: it consumes the award event. Because the award now arrives on the same tick as the text, the existing exact-expression safety check passes instead of racing, so completion, the completion coin, notes and line-completion rewards all fire at once.

4. **Panel wording follows reality.**
   With a complete proof the Score/Mark row reads `✓ Awarded` immediately. The "Equivalent detected / Score pending" warning is kept but becomes what it was meant to be: it only appears if a proved line has still not been marked after a short grace period — a real inconsistency, not the normal case.

5. **Background reconciliation stays authoritative.**
   The marking service still runs. If it ever disagrees with a locally proved line, its verdict wins and the line is corrected — as today.

6. **Same behaviour on the platform.**
   The Smartboard/assignment screens get the same instant award through the same path. Their UI, layout and wording are untouched.

## Not changing

Vault stays exact-sequence and never awards a mark. Rewards stay independent of scoring. Floating Numbers generation, room/stage design, Smartboard and assignment evaluation UI, and the grading service's authority all stay as they are.

## Technical notes

- `src/components/smartboard/PresentationView.tsx`: extract the predictive block from `gradeLineThroughEngine` into a synchronous `awardIfPredictivelyComplete(lineIndex, ascii)` called from the writing-update path (the same place that publishes `setFreeLines` / live cursor) and still guarded by `predictiveAwardedRef`, `solvedSlots` and `awardedExpressionBySlotRef`. Route map continues to come from `routeMapFor` keyed by `questionId:lineId`.
- New `src/lib/predictive/instantAward.ts`: pure `buildInstantAward({ questionId, lineId, marks, ascii })` used by the board broadcast and by the `lastAwardedLineId` / `lastAwardedExpression` context so `useGameRuntime`'s expression gate matches byte-for-byte after trimming.
- `src/lib/game/inspector.ts`: when `prediction.complete && !awarded`, report a new `awardPending` timestamp instead of setting `scoreInconsistent` straight away; `GameEvaluationPanel.tsx` shows `✓ Awarded` on a complete proof and raises the warning only past the grace window.
- Tests: instant award fires once per line and never twice; a one-sided fragment (`x + 7`) never awards; a Vault match alone never awards; backend `not_equal` revokes a locally awarded line; Game marks/notes/completion coin land on the same tick as the final symbol. Then a live pass on room Game `29a02610-08c0-4c4a-a083-bccce8ec2354` confirming the top score bar moves to `1 / 6` as the final piece lands, with no "Score pending".
