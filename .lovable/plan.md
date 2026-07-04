
## Upgrade AI Edit into an Autonomous Smartboard Operator

Today's `AiEditWorkspace` behaves like a chat helper: it parses the teacher's prompt, runs one repair recipe, and reports back. The new behavior treats the Presenter Preview as the source of truth and makes the AI **act on the Smartboard** — clicking, opening, erasing, retrying — exactly as a teacher would, then verifying against the Preview.

### 1. New operator loop

Replace the single `runManualEdit(target, prompt, ctrl)` call with an autonomous loop in `src/lib/smartboard/manualEdit/operator.ts`:

```text
select target
  → DIAGNOSE (probe board vs. preview, no writes)
  → REPRODUCE (perform the teacher gesture: click Note / click #-chip / scroll)
  → OBSERVE (read board signature after gesture)
  → ROOT-CAUSE (classify why the gesture failed)
  → REPAIR (apply the smallest matching recipe)
  → VERIFY (re-run the same probe)
  → repeat up to N attempts, escalating strategy each time
  → REPORT (pass, or structured failure with the exact failing step)
```

Each phase emits an `OperatorEvent` (`kind, label, ok, detail, tookMs`) so the drawer can render a live step list instead of a static report.

### 2. Probes — the "can I…?" tests

New file `src/lib/smartboard/manualEdit/probes.ts` with pure read functions built on the existing controller:

- `probeNote(lineIdx)` → `{ inPreview, onBoard, blocked, offscreen }` using `ctrl.getBoardHasNoteFor`, `getPreviewCardEl`, board row rect vs. viewport.
- `probeFloating(lineIdx, fillerIdx)` → compares `getExpectedPrefixSignatureFor` with `getBoardRowSignatureFor`, and checks whether the `#` panel opens.
- `probeLine(lineIdx)` → expected vs. actual row signature; detects overlap with previous/next row rects.
- `probeScroll(lineIdx)` → is the target row within the board viewport?
- `probeActiveLine()` → does `getActiveLineIdx()` match the selected line?
- `probeStructure(target)` → math-structure rendering (KaTeX span present, non-empty).

All probes are side-effect free. They feed both Diagnose and Verify.

### 3. Gestures — the "do it like a teacher" actions

New file `src/lib/smartboard/manualEdit/gestures.ts`. Each gesture is a small async function that drives the controller in the same order a teacher's hand would move:

- `clickNote(lineIdx)` — `scrollBoardTo → moveSensorToSafeRow → eraseNoteAt(if stale) → writeProseLineOnBoard(note) → markNotebookShown → addNotebookAttention`.
- `clickHash(lineIdx)` — `scrollBoardTo → moveSensorToSafeRow → openFloatingPanel`.
- `pickChip(lineIdx, fillerIdx)` — assumes panel open; `pickFloatingNumber`, else fallback to `writeEquationPrefix`.
- `writeQuestion(lineIdx, eq)` — `scrollBoardTo → moveSensorToSafeRow → writeQuestionLine`.
- `eraseRow(lineIdx)` — guarded `eraseRow(-1, lineIdx)`.
- `scrollIntoView(lineIdx)` — `scrollBoardTo` + settle wait.
- `retryLineFromScratch(lineIdx)` — erase → safe row → replay every chip in order → verify.

Gestures never touch notebook data or Preview state — only the board.

### 4. Root-cause classifier

New file `src/lib/smartboard/manualEdit/rootCause.ts`. Given `{target, probeBefore, gestureResult, probeAfter}` it returns one of:

`click-not-fired`, `panel-did-not-open`, `chip-not-registered`, `render-empty`, `sync-lost`, `mapping-missing`, `wrong-layer`, `blocked-by-overlap`, `outside-viewport`, `queue-missed`, `active-line-drift`, `structural` (last one = cannot repair from client).

Each root cause maps to an ordered list of repair strategies (see §5). The classifier is deterministic — no LLM.

### 5. Strategy ladder (escalation)

`src/lib/smartboard/manualEdit/strategies.ts` — per root cause, an ordered array of tactics. The operator tries them in order until Verify passes or the list is exhausted. Examples:

- `click-not-fired` → [replay gesture, reset active line then replay, scroll then replay].
- `panel-did-not-open` → [close+reopen panel, safe-row then reopen, erase row then reopen].
- `chip-not-registered` → [pick chip again, erase row + replay all chips up to k, writeEquationPrefix fallback].
- `render-empty` (note) → [rewriteNote, eraseNoteAt+rewrite, scroll+safe-row+rewrite].
- `blocked-by-overlap` → [moveSensorToSafeRow, drop extra row for fraction, eraseRow + replay].
- `outside-viewport` → [scrollBoardTo, then re-run original gesture].
- `active-line-drift` → [`setActiveLineIdx`, then replay].
- `sync-lost` / `queue-missed` → [`setBeatCursor` + `setActiveLineIdx`, replay].
- `structural` → stop and emit escalation report.

Tactics reuse the existing recipes in `presentationAI/repairs.ts` where they line up (`note-missing`, `filler-missing`, `line-mismatch`, `sensor-collision`, `board-scroll-lost`) so we don't duplicate logic.

### 6. Quick Suggestions become executable workflows

`SUGGESTED_PROMPTS` in `dispatch.ts` is replaced by `SUGGESTED_WORKFLOWS` — each entry pre-selects a root-cause hypothesis so the operator can skip Diagnose and go straight to the matching strategy ladder:

| Chip | Workflow |
| --- | --- |
| Note missing on board | force root cause `render-empty` on target's line note |
| Add floating number | `chip-not-registered` on selected filler (or first missing) |
| Solution line missing | `queue-missed` on selected line |
| Fix overlap | `blocked-by-overlap` |
| Fix spacing | `blocked-by-overlap` (drop-extra-row tactic first) |
| Bring into view | `outside-viewport` |
| Reset active line | `active-line-drift` |
| Re-render structure | `render-empty` with structure sub-strategy |

Clicking the chip immediately triggers the operator run — no textarea required. The textarea stays for free-form intents that still route through the keyword parser.

### 7. Drawer UX changes (`AiEditWorkspace.tsx`)

- Auto-start Diagnose the moment the drawer opens; show a live checklist as probes complete.
- Replace the current single "report" card with a phase timeline: Diagnose → Reproduce → Root cause → Repair (with tactic name) → Verify.
- Buttons collapse to a single **Stop** while running; **Retry** re-runs from Diagnose; **Cancel** closes.
- On terminal failure, render an "Escalate to code fix" block containing the full event trail, ready for the teacher to hand to Lovable.

### 8. Controller surface additions

Small, additive methods on `PresentationController` (only if not already exposed) — read-only where possible:

- `getBoardRowRect(lineIdx)` — for overlap and viewport probes.
- `isFloatingPanelOpen()` and `closeFloatingPanel()` — so gestures can reset the panel.
- `getBoardScrollTopFor(lineIdx)` — for `outside-viewport` probe.

No changes to notebook data, Presenter Preview rendering, or Autoplay flow.

### 9. Independence & safety

- Operator runs are isolated per drawer session; no shared state with Autoplay.
- Every gesture is guarded by `guardOwnerLineIdx` where applicable so the operator can only erase/rewrite the selected line's row and its own note.
- Hard cap: 5 tactics per run, 8 s per tactic, then escalate.

### Files

**New**
- `src/lib/smartboard/manualEdit/operator.ts` — the diagnose/reproduce/repair/verify loop.
- `src/lib/smartboard/manualEdit/probes.ts` — pure read tests.
- `src/lib/smartboard/manualEdit/gestures.ts` — teacher-style board actions.
- `src/lib/smartboard/manualEdit/rootCause.ts` — deterministic classifier.
- `src/lib/smartboard/manualEdit/strategies.ts` — ordered tactic ladders per root cause.

**Edited**
- `src/lib/smartboard/manualEdit/dispatch.ts` — thin wrapper that now calls the operator; `SUGGESTED_WORKFLOWS` replaces `SUGGESTED_PROMPTS`.
- `src/lib/smartboard/manualEdit/types.ts` — add `OperatorEvent`, `OperatorPhase`, `RootCause`, `Tactic`, extend `EditReport` with `events[]`.
- `src/components/smartboard/AiEditWorkspace.tsx` — auto-run on open, phase timeline UI, Stop/Retry controls, escalation block.
- `src/lib/smartboard/presentationAI/controller.ts` and `interface.ts` — expose the small read helpers listed in §8 if missing.

**Untouched**
- Presentation AI Autoplay, `usePresentationAI.ts`, `inspector.ts` internals, Presenter Preview panel selection layer, notebook data, backend/edge functions. No LLM call.

### Out of scope

- Sending diagnostics to an LLM. Everything is local and deterministic; a future upgrade can post the event trail to `notebook-ai`.
- Changing what "correct" means — the Presenter Preview + existing `inspector.ts` remain the arbiter.
