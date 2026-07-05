## Present clicks silently no-op because the sensor is on a locked/notebook row

### What's happening
`insertTextAtSensor` writes into whatever row `sensor.line` currently points at, via `editActive`. `editActive` has two silent‑swallow gates:

1. `notebookRowLines.has(floor(sensor.line))` — sensor is parked on a locked prose/notebook row → return without writing.
2. `isLockedInkRow(sensor.line)` — sensor is on a completed earlier line → return without writing.

On the earlier Present run those "dead cells" were `writeProseLineOnBoard` rows and got added to `notebookRowLines`. When the teacher clicks Present again, the sensor is still parked on one of those rows, so `editActive` silently swallows every click. That's why the status badge shows "✓ Written" (the mirror function ran) but nothing appears on the board.

### Fix — Present always writes on its own fresh writable row

Add one controller method that guarantees a live editable row before inserting, and route Present through it. Floating‑Number chip behaviour is untouched.

**1. `src/components/smartboard/PresentationView.tsx`**
Add a new `useCallback`:
```ts
const presentWriteAtSensor = useCallback((text: string) => {
  if (!text.trim()) return;
  // Snap the sensor to the first empty writable row below all ink,
  // skipping notebook-locked and locked-ink rows. This is what makes
  // every Present click land as LIVE, editable ink.
  const L = activeLayout;
  if (L) {
    const a = bandStart(L), b = bandEnd(L);
    const li = lastVisibleInkRow(L);
    let t = li >= a ? nextSensorRowBelow(li) : a;
    while (t <= b && (
      notebookRowLines.has(t) ||
      isLockedInkRow(t) ||
      !isEmptyWritableRow(t, L)
    )) t++;
    if (t <= b) setSensor((s) => (s.line === t ? s : { ...s, line: t, x: 0 }));
  }
  insertTextAtSensor(text);
}, [activeLayout, notebookRowLines, insertTextAtSensor]);
```
Expose it on the controller memo (add `presentWriteAtSensor` to returned object + deps).

**2. `src/lib/smartboard/presentationAI/controller.ts`**
Add:
```ts
/** Present-mode write: snaps sensor to next free live row, then
 *  inserts via the same route as a Floating Number chip. Result is
 *  live/editable and never lands on a locked/notebook row. */
presentWriteAtSensor?: (text: string) => void;
```

**3. `src/lib/smartboard/manualEdit/mirror.ts` — `applyMirror`**
Prefer the new method; fall back to the previous ones so nothing else breaks:
```ts
if (ctrl.presentWriteAtSensor) ctrl.presentWriteAtSensor(text);
else if (ctrl.insertTextAtSensor) ctrl.insertTextAtSensor(text);
else ctrl.writeProseLineOnBoard(text);
```

### Result per click
- The sensor advances to the next empty writable row (below all existing ink, past any locked/notebook rows).
- Text is inserted through the live `editActive` path — cursor lands inside, row is editable, teacher can add more, backspace, etc.
- Multiple Present clicks accumulate as consecutive live rows (matching the "S = fraction, S = fraction" pattern you saw before, but now live not dead).
- No board clearing. Floating Numbers still work in parallel. No verify, no autofix.

### Files touched
- `src/components/smartboard/PresentationView.tsx` — one new `useCallback`, one controller field, one deps entry.
- `src/lib/smartboard/presentationAI/controller.ts` — one optional method on the interface.
- `src/lib/smartboard/manualEdit/mirror.ts` — swap the call site.
