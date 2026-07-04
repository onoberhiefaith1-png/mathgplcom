## Presentation AI — Teacher Simulation Upgrade

Right now the Presentation AI advances beats/lines and reveals notes, but it **does not build math**. It reads the completed equation off the reservoir and moves on. This plan upgrades it into a real teacher: for every solution line it clicks Floating Numbers one-by-one, watches the equation grow on the Smartboard, drops the Teacher Note when the preview says so, and verifies the row against the Presenter Preview before advancing.

The Presenter Preview stays the single source of truth. Nothing about the preview model or the reservoir builder changes — only the AI stepper, the controller surface, and the inspector.

### 1. New step granularity (`model.ts`)

Replace the current `beat | line` steps with:

```text
beat  →  line-start  →  filler-0  →  filler-1  →  …  →  filler-N  →  note (opt)  →  line-verify
```

- `filler-k`: expected side-effect is that the equation prefix `fillers[0..k].join(" ")` is now on the board.
- `note`: only emitted when `isRenderableNote(line.notebook)` is true.
- `line-verify`: final gate before the next line — compares full row.

Notebook-only lines skip straight from `line-start` to `note` to `line-verify`.

### 2. Controller additions (`presentationAI/controller.ts`)

- `writeEquationPrefix(lineIdx, prefixTokenCount)` — teacher-style click emulation. Internally calls `writeProseLineOnBoard(fillers.slice(0, k).join(" "))` (which is already idempotent by row signature) so the row grows in place instead of duplicating.
- `getBoardRowSignatureFor(lineIdx)` — returns the current signature of the row owned by that guided line (uses the existing `rowOwners` map + `rowSignature`), so the inspector can compare.
- `getExpectedRowSignatureFor(lineIdx)` — mirror row signature for the full expected equation.

PresentationView already owns `writeProseLineOnBoard`, `rowOwners`, `mirrorLessonNoteRow`, and `rowSignature`. These new methods are thin wrappers exposed through `paiRefs`.

### 3. Stepper (`usePresentationAI.ts`)

- Per-line pacing: total `SPEED_MS[speed]` is divided across `fillers.length + (hasNote ? 1 : 0) + 1` sub-steps. Minimum floor of 250 ms per click so fast mode still looks like typing rather than a paste.
- On each `filler-k` tick: call `writeEquationPrefix(k+1)`, wait one frame + settle window, then `inspectStep`.
- On `note`: call `writeProseLineOnBoard(note)` + `markNotebookShown`.
- On `line-verify`: compare `getBoardRowSignatureFor` with `getExpectedRowSignatureFor`; on mismatch emit a `line-mismatch` issue and pause.

### 4. Inspector (`presentationAI/inspector.ts`)

Two new issue kinds, both `repairable: true`:

- `filler-missing` — expected prefix signature doesn't match the board row after a `filler-k` step. Repair: call `writeEquationPrefix(k+1)` again.
- `line-mismatch` — full row signature mismatch at `line-verify`. Repair: call `writeEquationPrefix(fillers.length)` once, then re-check; if still mismatched, mark `repairable: false` and let the panel offer **Generate Lovable Prompt** with expected vs actual signatures inlined.

Existing checks (`beat-cursor-drift`, `line-cursor-drift`, `note-missing`) stay.

Ordering rule (Rule 10 in the spec): when a `note` step is scheduled but the preview says a filler still comes after it, the inspector emits `sequence-mismatch` with expected/actual labels.

### 5. Diagnosis panel

No structural changes — the panel already renders `activeIssue.summary/expected/actual/probableCause/suggestedFix` and the Rectify / Proceed / Generate Prompt buttons. The new issue kinds plug straight in. Health % keeps ticking (green while `state === "presenting"`, red the moment `activeIssue` is set).

### 6. Files touched

- `src/lib/smartboard/presentationAI/model.ts` — new step kinds + builder.
- `src/lib/smartboard/presentationAI/types.ts` — new `IssueKind` values.
- `src/lib/smartboard/presentationAI/inspector.ts` — filler / sequence / mismatch checks.
- `src/lib/smartboard/presentationAI/repairs.ts` — recipes for the new kinds.
- `src/lib/smartboard/presentationAI/controller.ts` — new methods on the interface.
- `src/hooks/usePresentationAI.ts` — sub-step scheduler and per-tick pacing.
- `src/components/smartboard/PresentationView.tsx` — implement `writeEquationPrefix`, `getBoardRowSignatureFor`, `getExpectedRowSignatureFor`; wire into `paiRefs`.

No changes to lesson-note authoring, floating-number extraction, or the Presenter Preview panel — this is purely the AI's presentation loop.

### 7. Success criteria

- On autoplay, each solution line's equation appears on the Smartboard token-by-token, not all at once.
- Teacher Notes appear exactly where the Presenter Preview places them (between fillers if the preview has them there).
- Any drift (missing filler, wrong order, missing note, row signature mismatch) turns the diagnosis chip red, pauses playback, and offers Rectify / Proceed / Generate Prompt.
- End-of-lesson report counts every filler click and every note as inspected units.
