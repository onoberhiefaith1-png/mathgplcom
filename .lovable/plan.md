
# Live Mirror Mode — Presenter Preview as Single Source of Truth

## Goal

Replace the current AI Edit (diagnose → reproduce → repair) with a much simpler system:

- Enter AI Edit → Smartboard clears to a blank canvas.
- Teacher clicks any object in the Presenter Preview → that exact object appears on the Smartboard using the same presentation call the lesson normally uses.
- Teacher deselects (clicks again / clicks another object) → the previous object is removed.
- No regeneration, no reconstruction, no AI diagnosis. If clicking an object shows nothing, that is itself the diagnostic — the mapping for that object type is broken.

## Behaviour

```text
Click AI Edit
   ↓
resetBoard()  →  Smartboard is empty
   ↓
Teacher clicks Preview item  ────►  Smartboard shows exactly that item
Teacher clicks it again      ────►  Smartboard removes it
Teacher clicks another item  ────►  previous is removed, new one shown
```

Selection is single-item. A tiny "Exit Live Mirror" button restores normal presentation state.

### Clickable preview objects → matching Smartboard action

| Preview object | Smartboard action (existing controller call) |
|---|---|
| Cover / section / subsection heading | `writeProseLineOnBoard(headingText)` on a fresh row |
| Introduction / explanation prose line | `writeProseLineOnBoard(text)` |
| Example question line | `writeQuestionLine(lineIdx, equation)` |
| Solution line (full) | `writeEquationPrefix(lineIdx, allTokens)` |
| Individual floating number tile | `pickFloatingNumber(lineIdx, fillerIdx)` |
| Floating-number group header | `openFloatingPanel(lineIdx)` |
| Teacher Note | `markNotebookShown(idx)` / note-open path used in normal playback |
| Math structure / final answer | same call the normal presenter uses for that beat |

Each mapping is a one-liner that calls existing controller methods. No new rendering logic on the Smartboard side.

### Deselect semantics

Track `mirrorSelection: { targetKey, undo: () => void }`. When switching or unselecting:

- Line targets → `eraseRow(row, guardOwnerLineIdx)` for the row(s) the action created.
- Note targets → `eraseNoteAt(lineIdx)`.
- Floating tile → erase just that filler's ink (reuse the existing per-filler erase path used when a tile is un-picked in normal playback).
- Panel-opening actions → `closeFloatingPanel()`.

If a clean undo isn't available for a target, fall back to `resetBoard()` before rendering the next selection (still fast, since the board is otherwise empty in mirror mode).

### Verification signal (replaces "diagnosis")

After each click, wait one frame and check the corresponding board signature (`getBoardRowSignatureFor`, `getBoardHasNoteFor`, etc.). Show a small inline badge next to the clicked preview object:

- ✓ mirrored — signature matched.
- ✗ not mirrored — Smartboard produced nothing. Message: "Mapping for {objectType} is broken."

No repair attempts. No tactic ladder. No operator loop. The badge is the whole diagnostic.

## Scope of changes

### Remove / retire

Delete these files (the operator/diagnose/repair machinery is no longer used):

- `src/lib/smartboard/manualEdit/operator.ts`
- `src/lib/smartboard/manualEdit/probes.ts`
- `src/lib/smartboard/manualEdit/gestures.ts`
- `src/lib/smartboard/manualEdit/rootCause.ts`
- `src/lib/smartboard/manualEdit/strategies.ts`
- `src/lib/smartboard/manualEdit/pipelineTactics.ts`
- `src/components/smartboard/FixOverlay.tsx`

Autoplay never called the operator directly (only via `AiEditWorkspace`), so removing these does not touch normal presentation.

### Add

- `src/lib/smartboard/manualEdit/mirror.ts` — pure mapping table `{ target → apply(ctrl), undo(ctrl), verify(ctrl) }`. One entry per `EditTargetKind`.
- `src/hooks/useMirrorMode.ts` — hook that owns `active`, `selection`, and exposes `enter()`, `exit()`, `select(target)`.

### Rewrite

- `src/components/smartboard/AiEditWorkspace.tsx` — becomes a slim status strip: "Live Mirror Mode active — click any item in the Presenter Preview." Shows current selection + ✓/✗ verification, plus an Exit button. No timeline, no Fix Error, no tactics.
- `src/components/smartboard/PresenterPreviewPanel.tsx` — when mirror mode is active, every renderable node (headings, prose lines, question lines, solution lines, notes, floating chips, structures) becomes a button-role element that calls `select({ kind, beatId, lineIdx?, fillerIdx? })`. Selected item gets the existing highlight border. Also renders the ✓/✗ badge inline after verification returns.
- `src/lib/smartboard/manualEdit/types.ts` — keep `EditTarget` / `EditTargetKind`; drop operator/report/phase types that are no longer referenced.
- `src/lib/smartboard/manualEdit/dispatch.ts` — replace with a 5-line adapter that just calls `mirror.apply(target)`; suggestion-chip flow is gone.

### Untouched

- All lesson data, notebook, floating-number generation, backend, LLM.
- Normal Autoplay path in `PresentationView.tsx` and `usePresentationAI.ts` — the mirror hook uses the same controller methods Autoplay already uses; the presentation engine on the Smartboard does not change.
- `PresenterPreviewPanel` rendering of the lesson content is unchanged; only click handlers and a subtle badge column are added under a mirror-mode flag.

## Acceptance checks

1. Enter AI Edit → Smartboard is empty.
2. Click Introduction → prose appears; click again → gone.
3. Click Example 1 question → same equation appears as in normal play.
4. Click a solution line → the whole line writes out.
5. Click a Teacher Note → note appears exactly as in normal play; ✓ badge.
6. Click a floating chip → that filler appears at the correct position; ✓ badge.
7. If any of the above shows nothing → ✗ badge names the failing object type, without attempting any repair.
8. Exit Live Mirror → Smartboard returns to whatever state it had before entering (either empty or the pre-existing playback state, whichever we snapshot on enter — we snapshot & restore).

## Non-goals

- No new AI calls, no regeneration, no diagnosis, no repair.
- No changes to how content is generated or stored.
- No changes to student-facing Smartboard behaviour outside AI Edit.
