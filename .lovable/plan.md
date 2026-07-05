## Route Present chip clicks through the exact Floating‑Number Panel path

### The divergence

Two chip paths that should be identical are wired differently:

| Path | What it calls | Where the chip lands |
| --- | --- | --- |
| Floating‑Number Panel tap | `onInsert → insertTextAtSensor(text)` or `onInsertFrac → insertFractionAtSensor(parts)` | The **current sensor row**, at the cursor, inserted as a real math tree (fractions get real numerator/denominator magnet boxes). |
| Present‑mode chip click (current) | `ctrl.pickFloatingNumber(lineIdx, fillerIdx)` → `pickFloatingNumberReal` | A **line‑owned row** decided by the guided line's owner map; the chip is appended as a flat mirror row without magnet boxes. |

Result: a `x = □/□` chip placed via Present produces an ink structure whose boxes aren't the same magnet‑box tree the panel builds, so typing/clicking into those boxes gets rejected — "the sensor keeps getting pushed out." A chip placed via the panel builds proper magnet boxes and typing lands inside.

### Fix — one call path for chip taps

`src/lib/smartboard/manualEdit/mirror.ts` — in `applyMirror`, replace the `floating-number` branch with the panel's own logic:

```ts
if (target.kind === "floating-number") {
  const label = (target.text ?? "").trim();
  if (!label) return;
  const frac = parseFractionChip(label);
  if (frac && ctrl.insertFractionAtSensor) {
    ctrl.insertFractionAtSensor(frac);
    return;
  }
  // Panel wraps operator chips in spaces — parity.
  const op = /^[+\-−×÷=]/.test(label);
  const text = op ? ` ${label} ` : label;
  if (ctrl.insertTextAtSensor) ctrl.insertTextAtSensor(text);
  return;
}
```

- Import `parseFractionChip` from `@/components/smartboard/FloatingNumberPanel` at the top of `mirror.ts`.
- Drop the `pickFloatingNumber` call for chip taps entirely. (Leave the method on the controller — AI autoplay may still use it, but Present no longer does.)

`src/lib/smartboard/presentationAI/controller.ts` — expose the fraction inserter:

```ts
/** Insert a fraction at the ACTIVE sensor — same route as the Floating
 *  Number panel's fraction chip tap. */
insertFractionAtSensor?: (parts: { sign: string; num: string; den: string }) => void;
```

`src/components/smartboard/PresentationView.tsx` — controller memo: add
```ts
insertFractionAtSensor,
```
to the returned object and its dep array (right next to `insertTextAtSensor`). No new logic — the function already exists at line ~1252.

### What stays untouched
- `pickFloatingNumberReal`, its owner‑row placement, its use by AI autoplay.
- Beat‑cursor navigation for cover / section / subsection / question clicks (Next parity).
- Teacher‑note reveal path.
- Sensor writing path — `editActive` still writes literally at `sensor.line`.
- The Floating Number panel itself.

### Result
Clicking `x = □/□` in Present mode is now byte‑identical to tapping the same chip in the # panel:
- Fraction chip → `insertFractionAtSensor` inserts a real fraction node with empty magnet boxes, sensor lands inside.
- Non‑fraction chip → `insertTextAtSensor` inserts the tokens at the cursor.
- Subsequent chips / typing enter the magnet boxes normally, no more "sensor pushed out."
- Teacher can build any structure in either panel or Present with the same behaviour.
