## Typing lands somewhere other than the sensor — restore literal sensor writes and bring back the manual sensor rail

### Root causes

1. **`editActive` silently relocates writes.** When `sensor.line` sits on a "locked-ink" row (a completed earlier lesson line), `editActive` calls `relocatedWriteRow()` and (a) moves the sensor to that other row and (b) writes there. So any keystroke or Floating‑Number chip lands "somewhere else" instead of where the teacher parked the sensor. This is happening across the board — keyboard, chips, everything that funnels through `editActive`.
2. **The left‑rail sensor up/down control was removed in the previous turn.** The middle‑of‑board arrows the user saw are the *board scroll* arrows, not sensor movers. With the rail gone, teachers can't reposition the sensor manually, so once it lands on a bad row they have no recovery.

### Fix

**`src/components/smartboard/PresentationView.tsx` — `editActive`**

Remove the silent relocation. Writes always land at `sensor.line`. The only remaining gate is notebook‑prose rows (auto‑generated narration like "The quadratic formula is:"), which still swallow the write — those rows are structural, not writable. Locked‑ink rows lose their auto‑relocation.

Replace the body (roughly lines 1015–1062) with:

```ts
const editActive = (
  fn: (row: Row, c: Cursor) => { root: Row; cursor: Cursor },
) => {
  const line = sensor.line;
  // Notebook-prose rows render auto-generated narration and are the only
  // rows that stay non-writable. Every other row — including "locked-ink"
  // rows — must honour the teacher's sensor position exactly.
  const floorLine = Math.floor(line);
  if (notebookRowLines.has(floorLine) || notebookRowLines.has(line)) {
    hiddenInputRef.current?.focus({ preventScroll: true });
    return;
  }
  setFreeLines((prev) => {
    const row = prev[line] ?? [];
    const res = fn(row, cursorRef.current);
    setLiveCursor(res.cursor);
    const next = { ...prev };
    if (res.root.length === 0) delete next[line];
    else next[line] = res.root;
    return next;
  });
  hiddenInputRef.current?.focus({ preventScroll: true });
};
```

Effect: keyboard typing, Floating‑Number chip taps (via `onInsert → insertTextAtSensor`), and every other route into `editActive` now write exactly where the sensor is. Teacher owns the placement.

**Restore the manual sensor rail**

Put the `CursorScrollbar` block back near line 4926 (the location it used to occupy):

```tsx
{canEdit && carrierVisible && (
  <CursorScrollbar
    onUp={() => moveSensorUp(1)}
    onDown={() => moveSensorDown(1)}
    canUp={canCursorUp}
    canDown={canCursorDown}
    chromeBg={palette.chromeBg}
    chromeFg={palette.chromeFg}
    chromeBorder={palette.chromeBorder}
    leftPx={12}
    topCss="50%"
  />
)}
```

The import at the top of the file is still present, so no other change is needed.

### What stays untouched
- `applyMirror` — Present clicks still drive the beat cursor / floating panel / note reveal.
- `pickFloatingNumberReal` — still places floating‑number chips onto the guided line's owned row (that path never touched `editActive`).
- Notebook‑prose row protection.
- Everything about Normal mode, verify, autofix, board clearing.

### Result
- Sensor sits at row R → typing appends at row R.
- Floating‑Number chip tap → chip inserts at row R (sensor row).
- Sensor visibly moves only when the teacher taps the left‑rail arrow buttons (or one of the other explicit sensor moves).
- Silent jump‑to‑another‑row is gone.
