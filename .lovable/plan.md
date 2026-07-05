## Two fixes: Present must follow the sensor + remove the left-rail up/down

### 1) Present writes must land AT the sensor and advance like Floating Numbers do

Current behaviour: `presentWriteAtSensor` snaps to the first empty row *below all ink* on every click, so everything piles onto one row and the teacher's sensor position is ignored.

Desired behaviour (matches Floating‑Number semantics):

- **Block items** (`kind = "cover" | "section" | "subsection" | "question" | "teacher-note"`): write **at the sensor's current row**, then advance the sensor down one writable row so the next click gets a fresh line.
- **Chips / inline math** (everything else — `floating-number`, `solution-line`, chips like `5x`, `x²`, `+6`, `=0`): insert **at the sensor's cursor** on the current row and **do NOT advance** — teacher builds a line by tapping chips, exactly like Floating Number chip taps.
- **Safety only**: if the current sensor row is a notebook‑locked row (prose like "The quadratic formula is:") or a locked‑ink row, snap the sensor to the next free writable row *before* inserting, so nothing is silently swallowed. This is the only automatic move — otherwise honour whatever row the teacher parked the sensor on.

#### File changes

**`src/components/smartboard/PresentationView.tsx`**
Change `presentWriteAtSensor` to take an options object and drop the "snap to below all ink" logic:

```ts
const presentWriteAtSensor = useCallback(
  (text: string, opts?: { advanceAfter?: boolean }) => {
    if (!text.trim()) return;

    // Safety only: if sensor is on a locked/notebook row, hop to the
    // next writable row so the write isn't silently swallowed.
    const L = activeLayout;
    if (L) {
      const cur = Math.floor(sensor.line);
      if (notebookRowLines.has(cur) || isLockedInkRow(sensor.line)) {
        const b = bandEnd(L);
        let t = nextSensorRowBelow(cur);
        while (t <= b && (notebookRowLines.has(t) || isLockedInkRow(t))) t++;
        if (t <= b) setSensor((s) => ({ ...s, line: t, x: 0 }));
      }
    }

    insertTextAtSensor(text);

    // Block items advance the sensor down so the next click gets its
    // own fresh row. Chips do NOT advance (parity with Floating Number
    // chip taps).
    if (opts?.advanceAfter && L) {
      const b = bandEnd(L);
      const from = Math.floor(sensor.line);
      let t = nextSensorRowBelow(from);
      while (t <= b && (notebookRowLines.has(t) || isLockedInkRow(t))) t++;
      if (t <= b) setSensor((s) => ({ ...s, line: t, x: 0 }));
    }
  },
  [activeLayout, notebookRowLines, insertTextAtSensor, sensor.line]
);
```

**`src/lib/smartboard/presentationAI/controller.ts`**
Widen the signature:
```ts
presentWriteAtSensor?: (text: string, opts?: { advanceAfter?: boolean }) => void;
```

**`src/lib/smartboard/manualEdit/mirror.ts` — `applyMirror`**
Classify by `target.kind`:
```ts
const BLOCK_KINDS = new Set(["cover", "section", "subsection", "question", "teacher-note"]);
const advanceAfter = BLOCK_KINDS.has(target.kind);
if (ctrl.presentWriteAtSensor) ctrl.presentWriteAtSensor(text, { advanceAfter });
else if (ctrl.insertTextAtSensor) ctrl.insertTextAtSensor(text);
else ctrl.writeProseLineOnBoard(text);
```

Everything else in `applyMirror` (teacher-note note-gate silence) stays.

### 2) Remove the left‑rail up/down icons

The left‑side `CursorScrollbar` at `leftPx={12}, topCss="50%"` duplicates the up/down arrows already present in the middle of the board.

**`src/components/smartboard/PresentationView.tsx`** — delete the `CursorScrollbar` block at lines ~4922–4938 (the "Cursor up/down rail" JSX). Leave `moveSensorUp` / `moveSensorDown` (still used elsewhere) and the middle arrows untouched.

### Result

- Click **Introduction** (section) → lands where the sensor sits, sensor moves down one row.
- Click **Introduction** again → lands on the new sensor row, sensor moves down again.
- Click chip `5x`, then `=`, then `0`, then `+6` → all land on the current sensor row inline, sensor stays put (Floating‑Number‑chip parity).
- Left‑rail up/down icons gone; centre arrows remain.
- Floating Number workflow, board clearing, and verify/autofix are untouched.
