## Technical details
- Marking: trace `awardIfPredictivelyComplete` / `instantAward.ts` in `PresentationView.tsx` and the Game consumer in `ImaginePlayPage.tsx` / `useGameRuntime`; check whether the new `game:set-sensor` listener, auto slot entry or strip changes alter the line text/expression gate or skip the writing-update call. Add a vitest regression.
- Sensor visibility: initialise the cursor on row 1 when surfaces mount; render the blinking mark in the Game surface mirror regardless of focus; tap handler ignores row 0 via `rowOwnersRef`.
- Placeholders: reuse `newSlotEntry` and `treeMoveDown/Up` from `mathTree.ts` so denominator moves land inside the empty slot; Backspace deletes inside it.
- Verify with tests, `tsgo`, and a signed-in Playwright Game run (mark on final piece, sensor visible on load, tap on Q ignored, fraction denominator entry).
