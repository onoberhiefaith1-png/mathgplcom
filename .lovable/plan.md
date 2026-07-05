## Present mode = pure second writer — no analysis, no autofix, just fill the board

Right now Present mode (formerly Edit) runs a heavy pipeline every click: it waits for the beat cursor to settle, walks every earlier line and "restores" missing content, mirrors, verifies against the ink, and if any verification fails runs a 4‑step auto‑rectify ladder that can even clear ink and rewrite. That's analysis. You want it gone.

New behaviour: **one click = one write at the sensor.** No lookups, no verification, no repair, no earlier‑line restoration. Whatever the teacher clicks in the Presenter Preview is written verbatim onto the Smartboard at the current sensor row, exactly like an extra keyboard.

### What each click does

| Preview click | Board action |
|---|---|
| Cover | Write cover title at sensor |
| Section (Introduction, Explanation, Objectives, Summary, …) | Write that section's text at sensor |
| Subsection heading (e.g. "Example 1") | Write the caption at sensor |
| Example / Exercise Question | Write the question text at sensor |
| Teacher Note | Write the note text at sensor |
| Floating‑number chip (e.g. `5x`, `x²`, `−(5)`, `√(b²−4ac)`, `2a`) | Write that chip's text at sensor |
| `LINE k` label / hidden equation | Nothing (there is no equation to click in Present mode) |

Sensor advances after each write exactly like normal writing. Floating Numbers workflow is untouched and can be used in parallel.

### Code changes

**1. `src/lib/smartboard/manualEdit/mirror.ts` — `applyMirror`**
Replace the switch's per‑kind logic with a single behaviour: pull the exact text the preview captured on the click (`target.text ?? target.caption`) and call `ctrl.writeProseLineOnBoard(text)`. No `waitForBeat`, no `setBeatCursor`, no `setActiveLineIdx`, no `eraseNoteAt`, no `moveSensorToSafeRow`, no `writeEquationPrefix`, no `writeQuestionLine`, no `openFloatingPanel`, no `boardHasTextRow` idempotency check, no `scrollBoardTo*`. Just write. This also means chip clicks NO LONGER open the Floating Number panel — they write the chip text (matching your "click 5x → 5x appears" spec). Teacher notes still get `markNotebookShown` + `addNotebookAttention` so the note‑gate glow stops.

**2. `src/lib/smartboard/manualEdit/autofix.ts` — bypass the ladder**
`runMirrorWithAutofix` becomes a thin wrapper: emit `"Writing…"`, call `applyMirror`, emit `"✓ Written"`. No `ensurePriorLines`, no verify, no step 1–4, no ink clear, no rewrite. Kept as one file so `AiEditWorkspace` doesn't need to change.

**3. `src/lib/smartboard/manualEdit/mirror.ts` — `verifyMirror`**
Left in place but no longer called from the Present path. Kept exported so nothing else that imports it breaks.

**4. `src/components/smartboard/PresenterPreviewPanel.tsx` — status badge**
The `AiEditButton` inline badge currently shows "Mirroring… / Fixing step n/4 / ✓ / ✗". Simplified to just a brief `✓ Written` flash (or nothing) since there is no fixing anymore. Optional cosmetic change; can also leave it as `applying → ok` and it'll just show "Writing… → ✓".

**5. `src/components/smartboard/AiEditWorkspace.tsx` — no change needed**
It already just calls `runMirrorWithAutofix` and reports status. Since that function now just writes, the workspace becomes a pure passthrough.

### What is explicitly removed (the "analysis" you don't want)

- `ensurePriorLines` — no more scanning earlier lines and forcing missing floating numbers / notes onto the board.
- 4‑step auto‑rectify ladder — no retries, no "force section", no direct‑write fallback, no ink‑clear rewrite.
- `boardHasTextRow` verification — the board is never read back. If a click doesn't produce ink for some reason, the teacher just clicks again.
- Beat‑cursor synchronization — Present mode no longer moves the board's beat. If the teacher is presenting Section 2 in the preview while the board's beat is on Section 1, clicks still write at the current sensor. That's the "second writer" model.
- Row targeting per line — no `moveSensorToSafeRow`. The teacher already controls the sensor.

### What stays

- Normal mode is untouched.
- Floating Number workflow is untouched and runs alongside.
- The Smartboard is never cleared entering / leaving Present mode.
- Hidden equation lines inside Solution (already implemented last turn).
- Cover / prose section / question / note / chip click targets in the preview.

### Out of scope

- Making the completed equation clickable in Present mode. It's hidden by design so the teacher builds via chips + notes.
- Splitting a rendered equation into atomic sub‑tokens beyond the authored floating‑number fillers.
- Removing / renaming `manualEdit/` folder or `EditTarget` type names — internal only, no user impact.
