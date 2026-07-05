# Diagnosis: why the note doesn't appear and the sensor jumps ~4 rows

Both note buttons — the notebook icon on the Floating Number Display AND the note item in Presenter Preview (Present mode) — currently end up in the **same shared writer** (`writeProseLineOnBoard`), and the Presenter Preview route additionally depends on the **sensor position that the Floating Number workflow controls**. That's why the same error appears in both: they are not independent channels.

Inside that shared writer there are two "silent failure" paths that match exactly what you saw:

1. **False "already on the board" match.** Before writing, the writer checks whether a board row already has the same signature as the note's first line. When it *thinks* it finds a match, it writes NOTHING and only advances the sensor below the supposed existing note — skipping over every occupied row. Result: no note appears, sensor jumps several rows down.
2. **Parity-gate refusal.** If the note text fails the mirror gate, the writer silently returns without inking anything.

And the Presenter Preview note route (`applyMirror`, kind `teacher-note`) writes "at the current sensor position" — i.e. wherever the Floating Number workflow last left the sensor — instead of anchoring the note under its own line. So the preview is NOT one-to-one with the board today; it inherits the FN system's state.

# Changes

1. **Dedicated direct channel: Presenter Preview note → board.**
   In `applyMirror` (teacher-note case), stop writing "at the sensor". Compute the target row from the note's OWN line: find the board row owned by that line (via the row-owners map, same anchoring the board uses internally) and place the note directly below it. No sensor dependency, no Floating Number state involved. The click carries `lineIdx` + verbatim `text` — a one-to-one write.

2. **Kill the silent no-op paths in the note writer.**
   - When the "already on board" signature match fires, verify the matched row is genuinely this note's ink; scroll to it so the teacher SEES it. If the match is stale/wrong, write the note anyway instead of only moving the sensor.
   - When the parity gate refuses, fall back to writing the note as plain text characters — a note click must ALWAYS produce visible ink, never a bare sensor jump.

3. **Floating Number Display note icon benefits too.** It calls the same writer, so fixing the silent no-op paths repairs the FN route as well — but the two routes remain independent: FN anchors via its own flow; Presenter Preview anchors via its own lineIdx. An FN failure can no longer replicate into the backup channel.

## Files touched
- `src/lib/smartboard/manualEdit/mirror.ts` — teacher-note case: anchor under the note's own line row, direct write, no sensor read.
- `src/lib/smartboard/presentationAI/controller.ts` — expose a `writeNoteForLine(lineIdx, text)` (or equivalent) so the mirror can write without touching sensor/FN state.
- `src/components/smartboard/PresentationView.tsx` — implement the anchored note write; fix the idempotency false-positive and parity-gate silent-fail in `writeProseLineOnBoard`.

## Verification (done in build mode, before claiming fixed)
- Playwright reproduction first: open the notebook, go to line 3, click the note on the Presenter Preview (Present mode) — confirm the current bug (no ink, sensor jump), then confirm after the fix the note text appears directly under line 3's row.
- Repeat via the Floating Number Display notebook icon — note must appear there too.
- Screenshot evidence for both routes + typecheck + existing sensor/note tests (`sensorSpacing`, `noteAttachmentConsistency`).

No backend changes.