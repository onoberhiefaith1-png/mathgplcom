## How the Floating Number Display is meant to work

The strip is a **conveyor belt**, not a static list:

1. The lesson note supplies a fixed, ordered reservoir of fragments (the "Floating Collection"). The Smartboard only displays it — it never regenerates or reorders it.
2. A fixed-size window shows a few fragments at a time.
3. When the teacher **taps a fragment**, three things happen together:
   - the fragment is written onto the whiteboard at the sensor,
   - the fragment is marked **Used**,
   - the window **shifts**: earlier visible chips hold their place, the used chip leaves the active ring, and the next hidden fragment flows in **from the right**.
4. Tapping a **Used** chip returns it to the ring in its original reservoir position.
5. Deleting the ink from the board also returns the fragment to the ring automatically (Used means "currently on the board").

So "moving to the right" is the visible result of rule 3 — the used chip is consumed and the belt advances.

## What is actually happening now

The tap logic itself is intact. `handleActiveTap` in `FloatingNumberPanel.tsx` still marks the fragment used, records the click order, and recalculates the window anchor so a new chip enters from the right. The click handler still dispatches to it, and the parent still passes `consumedAbsIdx` / `onUse` / `onUnuse`.

The break is **downstream**, in `PresentationView.tsx`. There is a reconciliation effect (around lines 2559-2590) that implements rule 5: after every board change it re-derives the Used set by searching the whiteboard's plain text for each used fragment's normalised label. If it cannot find the text, it assumes the ink was deleted and **un-marks the fragment**.

That text search cannot match ink that was not written as a plain matching string — most importantly fragments inserted as **stacked fractions** (`onInsertFrac` → `insertFractionAtSensor`), which build a structured fraction node rather than a `num/den` string. Any other structured write path (roots, powers rendered as structures) has the same problem.

Result: tap → chip is marked used and the belt starts to advance → the effect runs on the very next render, fails to find the text, deletes the index from `consumedAbsIdx` → the chip snaps back into the ring. Visually: **the floating number does not move.**

## The fix

**1. Stop deriving Used from board text. Derive it from board identity.**
Tag every board write that comes from a floating fragment with the fragment's absolute reservoir index (an id carried on the free-line row / fraction node / box that produced it). The reconciliation effect then asks "does a board element tagged with index N still exist?" instead of "does this string appear somewhere in the ink?". This is exact for every write path — plain text, fractions, roots, structures — and keeps rule 5 (delete the ink → chip returns) working correctly.

**2. Make the reconciliation effect conservative during the transition.**
Never un-mark an index that was marked in the same interaction tick; only un-mark on a genuine board mutation. This removes the snap-back race even if a write path is missed.

**3. Verify against the live board, not just unit tests.**
Drive the Smartboard with Playwright: tap a plain fragment, tap a fraction fragment, confirm in both cases that the chip becomes Used, the window advances by one and a new chip appears on the right, and that deleting the ink returns the chip to its original slot.

**4. Regression tests.**
Add tests covering: tap advances the window right; tap of a fraction fragment stays Used after the reconciliation effect runs; deleting the ink un-marks it; tapping a Used chip restores its original position.

## Technical notes

- Files involved: `src/components/smartboard/FloatingNumberPanel.tsx` (tap + window model — expected to need little change), `src/components/smartboard/PresentationView.tsx` (the reconciliation effect, `normalizeFloatingPresence`, `countTokenOccurrences`, `onInsert` / `onInsertFrac` wiring), plus the sensor-write helpers that create fraction nodes.
- No change to the lesson-note reservoir, its order, or the extraction pipeline — the Smartboard remains display-only.
- One open item to confirm during implementation: whether any non-fraction write path also loses text fidelity; the identity-tag approach makes that moot, but I will confirm it in the live test.
