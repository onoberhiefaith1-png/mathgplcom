## Why the previous fix didn't take effect

My earlier post-structure-gap fix scanned upward from `target - 1`. That works when the sensor sits BELOW the fraction, but in the failing screenshot the sensor is parked on the SAME row as the fraction (target = fracRow). The upward scan finds nothing above, no bump is applied, and the paragraph placement loop just does `target++` past the occupied fraction row — landing the note on `fracRow + 1`, i.e. flush against the denominator.

## Fix

In `writeProseLineOnBoard` (src/components/smartboard/PresentationView.tsx, ~lines 1128-1163), replace the current placement loop with one that respects the tall-structure footprint at every step, not just at the initial target:

```ts
const rowIsTall = (r: number): boolean => {
  const row = next[r] ?? next[r + 0.5];
  return !!row && rowHasVisibleInk(row) && rowHasTallStructure(row);
};

// Enforce gap for the initial target too (covers the case where the
// sensor is parked ON the tall row, not just below it).
if (rowIsTall(target)) target = nextSensorRowBelow(target);
// And also when the row directly above is tall (existing behaviour).
else if (target > 0 && rowIsTall(target - 1)) {
  target = Math.max(target, nextSensorRowBelow(target - 1));
}

for (const m of mirrored) {
  // Skip occupied rows; when an occupant is a tall structure, jump
  // past its full multi-row footprint + one empty breathing row.
  while (occupied(target)) {
    target = rowIsTall(target) ? nextSensorRowBelow(target) : target + 1;
  }
  next[target] = m.row;
  newNotebookRows.push(target);
  target += 1;
}
```

`nextSensorRowBelow(r)` already returns `r + 1 + extraRowsFor(r) + sensorGapRowsBelow(r)`, which is exactly the "one full empty row after any structure that spans more than one row" rule.

## Verification

Drive Playwright against `/smartboard/...`, reproduce the flow:
1. Write `x² + 8x − 1 = 0`
2. Click notebook "The quadratic formula is:"
3. Insert the stacked fraction `x = (−b ± √(b² − 4ac)) / 2a`
4. Click notebook "For the given equation, a = 1, b = 8, c = …"

Screenshot and confirm there is at least one empty row between the fraction's denominator and the second notebook line. No other files need changes.