## Present writes must land as live sensor ink, not dead notebook rows

### What's happening
`writeProseLineOnBoard` (used by Present) commits the text as a **notebook row** — it's added to `notebookRowLines`, which is a sensor-restricted, locked-ink row: no cursor, not editable, no ability to add more ink or move around inside it. That's the "dead cell" you're seeing.

The Floating Number chip path uses a completely different route: `insertTextAtSensor(text)`, which mirrors the text through the same lesson-note pipeline and then inserts each node into the **currently active sensor row** via `editActive` — same route as typing on a keyboard. That's why the floating-number one is alive: cursor inside, editable, further ink can be added.

### Fix — route Present through the same live path as floating chips

**1. `src/components/smartboard/PresentationView.tsx`**
Expose the already-existing local `insertTextAtSensor` on the controller memo (add it to the returned object and to the deps array). Wrap it in a `useCallback` so its identity is stable.

**2. `src/lib/smartboard/presentationAI/controller.ts`**
Add one optional method to the `PresentationController` interface:
```ts
/** Insert text into the ACTIVE sensor row — same route as tapping a
 *  Floating Number chip. Result is live/editable, cursor stays inside. */
insertTextAtSensor?: (text: string) => void;
```

**3. `src/lib/smartboard/manualEdit/mirror.ts` — `applyMirror`**
Switch the write call:
```ts
const text = (target.text ?? target.caption ?? "").trim();
if (!text) return;
if (ctrl.insertTextAtSensor) ctrl.insertTextAtSensor(text);
else ctrl.writeProseLineOnBoard(text);
```
Everything else stays: teacher-note kind still marks the note-gate as satisfied so the glow stops.

### Effect on each click
- Cover / section / question / subsection captions → written into the active sensor row, sensor moves inside the text like normal typing. Teacher can keep adding to the same line, or move sensor down and click the next preview item.
- Chip (`5x`, `x²`, `−(5)`, `√(b²−4ac)`, `2a`) → inserted at the current cursor position inside the active sensor row, exactly like tapping a Floating Number chip. Live, editable.
- Teacher note → also written live; teacher can then move the sensor down and continue.

### Not changed
- Normal mode.
- Floating Number workflow — completely untouched, runs in parallel.
- No board clearing on entering/leaving Present.
- Hidden equation lines inside Solution in Present mode (from prior turn).
- No verification, no autofix — still a pure second writer.

### Files touched
- `src/components/smartboard/PresentationView.tsx` (add `insertTextAtSensor` to controller + deps, wrap in `useCallback`)
- `src/lib/smartboard/presentationAI/controller.ts` (interface line)
- `src/lib/smartboard/manualEdit/mirror.ts` (call the live inserter)

Three small, surgical edits. No other file needs to change.
