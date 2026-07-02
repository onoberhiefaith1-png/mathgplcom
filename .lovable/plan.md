
## Bug

While typing on lesson line 4 (or 5), the Floating Number display suddenly jumps back to line 3 and the sensor snaps upward. This repeats on every new keystroke that lands on a row the teacher chose after a blank spacer row.

## Root cause

The **INTELLIGENT ERASE** effect in `src/components/smartboard/PresentationView.tsx` (≈ lines 2220–2253) assumes that lesson line *k* always lives at physical row `a + k` (where `a = bandStart`). It scans:

```ts
const row = freeLines[a + k];         // fixed offset — wrong
const ok = row && equationsMatch(rowToAscii(row), guidedLines[k].equation);
if (!ok) lostTop = k;                 // rewind trigger
```

But the Smartboard is lesson-line-driven, not row-driven: the teacher can leave blank spacer rows between lines (this is the same freedom you asked for in the Final Redesign). Row ownership is tracked via `rowOwners`, not by a `k → a+k` mapping.

Reproducing what you're seeing:

```text
row a+0 : x + y = 7 (1)     ← line 0 (owned)
row a+1 :                   ← blank spacer
row a+2 : x − y = 3 (2)     ← line 1 (owned)
row a+3 :                   ← blank spacer
row a+4 : Add (1) and (2):  ← notebook / line 2
row a+5 : x+(x)+y−y = 7+3   ← line 3 (owned)
row a+6 : x+x+y−y = 10      ← line 4 (owned, being typed)
```

The effect walks `k = activeLineIdx − 1 … 0` and checks `freeLines[a + k]`. For `k = 3` it reads `freeLines[a + 3]` — an empty spacer — decides line 3 is "lost", triggers:

```ts
setActiveLineIdx(lostTop);        // FN display jumps back
setFloatingLineIdx(lostTop);
activeSensorLogicalIdxRef.current = null;   // sensor re-anchors upward
```

That's exactly the symptom: FN panel rewinds, sensor snaps to the previous line's last owned row. Because the effect depends on `freeLines`, every keystroke re-fires it.

The two neighbouring effects (`PASSIVE LINE-MATCH DETECTION`, `RESUME TO HIGHEST COMPLETED LESSON LINE`) share the same `a + k` assumption; the resume-effect only runs once per reservoir, and the passive-match effect already scans the whole band, so they aren't causing the live regression — but the erase effect needs to move to the same ownership-based lookup for consistency.

## Fix

Make the erase effect look up each lesson line by **row ownership** instead of a fixed offset:

1. Get the rows owned by line *k* from `rowOwners` (the existing map used by the sensor logic):
   ```ts
   const owned = Object.entries(rowOwners)
     .filter(([, o]) => o === k)
     .map(([r]) => Number(r))
     .filter(Number.isInteger)
     .sort((x, y) => x - y);
   ```
2. If `owned.length === 0`, line *k* was never written on this session — skip (do NOT treat as "lost"; nothing to rewind).
3. Otherwise, concatenate the ascii from every owned row and compare against `guidedLines[k].equation` with the existing `equationsMatch` / `equationsEquivalent`. If none of the owned rows still holds matching ink, mark that line as `lostTop` and only then rewind.
4. Keep the "only rewind the LATEST completed line" guard (`lostTop === activeLineIdx − 1`).

This preserves the intended behaviour ("teacher erases the most recent completed line → rewind so they can redo it") while eliminating the false-positive that fires every time an unrelated spacer row is empty.

## Files to touch

- `src/components/smartboard/PresentationView.tsx` — rewrite the effect at lines ~2220–2253.

## Verification

- Add a regression test in `src/test/sensorSpacing.test.ts` that seeds `guidedLines` + `rowOwners` with a spacer row between lines, mutates `freeLines` on a fresh row, and asserts the rewind logic does NOT trigger (i.e. `lostTop` stays `−1`).
- Manual: reproduce your scenario — finish `x+y=7(1)` on row a+0, skip a row, write `x−y=3(2)`, skip a row, write notebook prose, then start typing line 4. Confirm the FN panel stays on line 4 and the sensor stays put.
- Run the full vitest suite; expect 127+ passing.
