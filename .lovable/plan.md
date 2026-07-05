## Present clicks drive the beat cursor — Next-button parity

The Smartboard already fully renders every section, example, and note through one state variable: `beatCursor` (Next = `beatCursor + 1`). Present mode must dispatch clicks into that same pipe instead of writing text at the sensor.

### New click semantics for `applyMirror`

Classify by `target.kind`:

| kind | action |
| --- | --- |
| `cover` | `setBeatCursor(idxOf(beatId))` |
| `section` (prose block) | `setBeatCursor(idxOf(beatId))` |
| `subsection` (example header) | `setBeatCursor(idxOf(beatId))` |
| `question` | `setBeatCursor(idxOf(beatId))` (same beat as the subsection) |
| `floating-number` chip | `pickFloatingNumber(lineIdx, fillerIdx)` — exact same call the # panel makes |
| `teacher-note` | `writeProseLineOnBoard(text)` + `markNotebookShown(lineIdx)` + `addNotebookAttention(lineIdx)` — same effect as the Next-key note reveal |
| `solution-line` | no-op (Present-mode line clicks are already disabled in `PresenterPreviewPanel`) |

`idxOf(beatId) = ctrl.beats.findIndex(b => b.id === beatId)`. If not found, do nothing.

Skipping works for free: `setBeatCursor(k)` jumps directly to k; beats between the old cursor and `k` never render (`Example 1 → Example 4` skips 2 and 3, exactly what the user described).

Highlight parity is also automatic: `activeBeatId` in `PresenterPreviewPanel` reads from `beats[beatCursor]`, so the moment we set the cursor the panel highlights the same beat.

### File changes

**`src/lib/smartboard/manualEdit/mirror.ts` — replace the body of `applyMirror`:**

```ts
export const applyMirror = async (
  target: EditTarget,
  ctrl: PresentationController,
): Promise<void> => {
  const text = (target.text ?? target.caption ?? "").trim();

  // Beat-navigation kinds — same route as pressing Next until the target
  // beat is active. Instantly jumps; skipped beats are simply not shown.
  if (
    target.kind === "cover" ||
    target.kind === "section" ||
    target.kind === "subsection" ||
    target.kind === "question"
  ) {
    if (!target.beatId) return;
    const idx = ctrl.beats.findIndex((b) => b.id === target.beatId);
    if (idx >= 0) ctrl.setBeatCursor(idx);
    return;
  }

  // Floating-Number chip — same route as tapping the chip in the # panel.
  if (
    target.kind === "floating-number" &&
    typeof target.lineIdx === "number" &&
    typeof target.fillerIdx === "number"
  ) {
    ctrl.pickFloatingNumber?.(target.lineIdx, target.fillerIdx);
    return;
  }

  // Teacher-note — reveal on the board and silence the note-gate glow.
  if (target.kind === "teacher-note" && typeof target.lineIdx === "number") {
    if (text) ctrl.writeProseLineOnBoard(text);
    ctrl.markNotebookShown?.(target.lineIdx);
    ctrl.addNotebookAttention?.(target.lineIdx);
    return;
  }

  // Anything else (e.g. solution-line, unclassified) — intentional no-op.
};
```

Delete the `presentWriteAtSensor` / `insertTextAtSensor` / `writeProseLineOnBoard` fallback branch — Present is no longer a "second writer."

**`src/components/smartboard/PresentationView.tsx`** — no logic change required. The `presentWriteAtSensor` and `insertTextAtSensor` methods stay on the controller (still used by the Floating Number panel's own chip taps and the free-write flow); we just stop calling them from Present clicks. Optionally drop the `presentWriteAtSensor` callback since nothing will call it any more, but leaving it is harmless.

**`src/lib/smartboard/presentationAI/controller.ts`** — no change; every method we need is already there.

### What stays untouched
- Floating Number panel behaviour, its chip taps, and the note-gate advance flow.
- Normal-mode Smartboard rendering, sensor behaviour, and the Next button.
- Board clearing, verify, autofix — none of them run.
- The `PresenterPreviewPanel` selection UI: `selectTarget` still fires, still shows the selected outline, still calls `onMirrorChange` — only `applyMirror`'s downstream behaviour changes.

### Result
- Click `Introduction` → beatCursor jumps to Introduction's beat → the smartboard renders Introduction and the panel highlights it, exactly like pressing Next.
- Click `Example 1` → beatCursor jumps to Example 1's beat.
- Click `Example 4` after `Example 1` → beatCursor jumps to 4, skipping 2 and 3.
- Click a chip → same as tapping it in the # panel (opens / focuses # panel on that line, writes the chip into the sensor row).
- Click a note → note appears on the board, glow stops.
- No more "everything types on one row" — nothing types anywhere unless it's a chip or note, and those use the smartboard's own routes.
