## Goals from your test

1. **Present Mode and Floating Number Display must be fully independent.** An error on one must never appear on the other. Right now, an error you introduced on Floating leaked into Present, so a shared path still exists.
2. **Sensor is stiff** when starting a new line, especially after a fraction chip. First tap often doesn't "catch", or it drifts upward and needs to be nudged down manually.
3. **Notes stop working partway through** (first few notes fine, later ones don't fire). The note-writing code must behave identically for line 1 and line N.
4. **Remove Autoplay entirely** — no more speed picker, no AI diagnosis button, no autoplay controller.

---

## Plan

### A. Cut every remaining Present ↔ Floating link

Investigate and sever any code path where a click, error, or state on one side can reach the other:

- Audit `PresentationView.tsx`, `FloatingNumberPanel.tsx`, `PresenterPreviewPanel.tsx`, `AiEditWorkspace.tsx`, and the two engines (`engines/floatingEngine`, `engines/presentEngine`).
- Confirm each engine only touches its **own** channel (`floatingChannel` vs `previewChannel`) and its **own** ledger state. Any shared mutable state (e.g. a single row-owner map, a single `noteShown` set, one shared board snapshot cursor) gets **split into two independent copies** — one per engine.
- Any shared helper (`noteSource`, `buildReservoirs`, etc.) is allowed **only** if it is pure/read-only against `LessonModel`. Anything that mutates board state gets duplicated per engine.
- Add a static guard test extending `engineIndependence.test.ts` to also forbid cross-imports of shared board-mutating helpers, not just channels.

Result: wiping the board and re-typing in Floating cannot alter what Present renders, and vice versa.

### B. Make the sensor flexible (fix "stiff" first tap and fraction stiffness)

Root cause candidates to check and fix:

1. **First-tap deadzone after a new line.** The sensor position is computed from "last visible ink + 1", but after a fraction the row may still be settling (fraction ink spans row + row+0.5). Fix: recompute sensor target on **every chip tap**, not once per line, and always read both integer and half-row keys.
2. **Sensor drifting upward.** Enforce a monotonic floor: sensor row for line N is always ≥ (last committed row of line N-1) + tall-padding. Never allow it to move above the previous line's last ink.
3. **Fraction chip stiffness.** When a chip is a fraction, the current code inserts and then waits for a render pass before advancing. Make chip inserts commit synchronously against the ledger so the next tap has an updated sensor immediately.
4. **Manual nudge tolerance.** If the teacher taps and the sensor is already occupied, auto-relocate one row down instead of silently rejecting the click.

### C. Fix late notes (uniform behavior across all lines)

The symptom "first few notes work, last note fails" almost always means the note pipeline branches on state (e.g. "if already advanced past this line, skip note"). Fix:

- Route **every** note write through a single function: `writeNoteForLine(lineIdx)` reading only `LessonModel.solutionLinesFor(beat)[lineIdx].note`.
- Remove any short-circuit that skips notes when `noteShown` is already set for a later line, when the sensor is past that row, or when the line is "locked".
- Notes are always allowed to write into their own dedicated row (below the equation), with LAW 2 relocation if occupied.
- Add a regression test that clicks the note button on **every** line 1..N and asserts each writes ink.

### D. Delete Autoplay completely

Remove:
- `src/components/smartboard/AutoplayControl.tsx`
- `src/hooks/usePresentationAI.ts`
- `src/lib/smartboard/presentationAI/` (controller, types, speed presets, AI diagnosis)
- Any imports/usages in `SmartBoardPage.tsx`, `PresentationView.tsx`, `AiEditWorkspace.tsx`
- The AI Diagnosis modal and its state
- Speed preset UI, keyboard shortcuts, and toolbar chips

Keep only: manual Present Mode (click preview to write) and Floating Number Display.

### E. Verification

- All existing tests pass; add: engine-independence expansion, per-line note regression, fraction-chip sensor flexibility test.
- Manual Playwright pass on the lesson from the current route: solve to the end via Floating, wipe, solve to the end via Present — errors introduced in one must not appear in the other.

---

### Files expected to change

- edit: `PresentationView.tsx`, `PresenterPreviewPanel.tsx`, `FloatingNumberPanel.tsx`, `AiEditWorkspace.tsx`, `SmartBoardPage.tsx`
- edit: `engines/floatingEngine/index.ts`, `engines/presentEngine/index.ts`
- edit: `boardWriter/floatingChannel.ts`, `boardWriter/previewChannel.ts`, `boardWriter/ledger.ts` (split shared state if found)
- edit: `preview/model.ts` (single note accessor already exists; verify no branches)
- delete: `AutoplayControl.tsx`, `usePresentationAI.ts`, `presentationAI/` folder
- new tests: `enginePresentFloatingIsolation.test.ts`, `notesEveryLine.test.ts`, `sensorFlexibility.test.ts`

Nothing in this plan touches lesson-note generation, backend, or the pedagogy pipeline — it is purely rendering + input handling on the Smartboard.
