
## Give the AI Operator "Pipeline Power" — Fix Error until it lands

The current operator diagnoses "note-not-clickable on Line 1" but stops there because its ladder tops out at "replay click." The Presenter Preview is the source of truth, so the operator must be able to force any preview content onto the Smartboard — even when the normal click/render pipeline is broken. This plan expands the tactic ladder, adds a real-time "Fix Error" mode, and shares the same repair power with Autoplay.

### 1. Rename the primary control to **Fix Error**

`AiEditWorkspace.tsx`:
- Replace the current *Cancel / Run / Retry* footer with a single primary **Fix Error** button (destructive-red styling) that is always visible until the issue is resolved.
- While the loop runs it becomes **Fixing… <elapsed>s** with a Stop affordance next to it.
- After success the button turns into **Fixed ✓** for 2s, then hides.
- After the ladder fully exhausts, it becomes **Fix Again** (re-run from Diagnose with an escalation flag that unlocks the invasive tactics up front).

Auto-diagnose on open stays, but its purpose is only to *pre-fill* the root cause. Nothing runs until the teacher presses **Fix Error** — matches the user's mental model.

### 2. Live "on-screen" progress

The drawer already renders a timeline. Add:
- A **status bar** at the top of the timeline: *"Fixing: Line 1 note — Testing tactic 3 of 7 — elapsed 1.4s"*.
- A **flash toast on the Smartboard column itself** (`FixOverlay.tsx`, absolute-positioned over `PresentationView`) that mirrors the current tactic in large text: *"Testing: dispatch synthetic click on note button…"*, *"Testing: force render via controller…"*, *"Verifying…"*. The overlay auto-hides on success.
- A per-tactic **result chip** (✓ / ✗) that appears next to the tactic row the moment its Verify probe returns.

This gives the teacher the "I can see it working" experience they asked for.

### 3. Expand the tactic ladder — the "pipeline power"

New file `src/lib/smartboard/manualEdit/pipelineTactics.ts`. Each tactic is progressively more invasive; the operator walks the ladder until Verify passes:

**Note pipeline (Line 1 case):**
1. **Replay click via controller API** — `clickNote` gesture (current behavior).
2. **Scroll + reset active line + replay** — clears cursor drift.
3. **Dispatch synthetic DOM click on the note button** — `document.querySelector('[data-note-button][data-line-idx="N"]')` → `element.dispatchEvent(new MouseEvent('click', {bubbles:true}))`. Requires adding `data-note-button` / `data-line-idx` attributes to the preview panel's Note affordance (small edit in `PresenterPreviewPanel.tsx`).
4. **Force-open Note via controller side door** — call `writeProseLineOnBoard(note)` after `moveSensorToSafeRow` and `markNotebookShown`. Bypasses the click handler entirely.
5. **Erase note row + re-inject** — `eraseNoteAt(lineIdx)` → safe row → `writeProseLineOnBoard` → `markNotebookShown` → `addNotebookAttention`. Rebuilds ownership.
6. **Rebuild row mapping** — new controller call `rebuildRowOwnership(lineIdx)` that clears the internal `rowOwners` entry for the line and re-runs `moveSensorToSafeRow`, then re-injects. Fixes stale mapping (the exact "note-not-clickable" symptom).
7. **Full re-render of the line region** — new controller call `forceRepaintLine(lineIdx)` that bumps a per-line paint counter, causing the board renderer to re-mount that row's ink, then re-inject.

**Floating-chip pipeline:** already have panel/pick/erase tactics — add:
- **Synthetic click on the `#` FAB and chip tiles** using new `data-fab="hash"` / `data-chip="lineIdx-fillerIdx"` attributes.
- **Bypass panel: writeEquationPrefix as final fallback** (already present, promoted to tactic 6).

**Line pipeline:** add
- **Synthetic click on Line reveal button** where applicable.
- **`forceRepaintLine` + `retryLineFromScratch`** as the last resort.

**Universal fallbacks (any target):**
- **Reset beat cursor + active line** (`sync-lost`).
- **Reset board scroll to line row** (`board-scroll-lost`).

Cap: 7 tactics per run, 6 s per tactic, hard 20 s overall wall-clock.

### 4. Controller additions (thin, additive)

`src/lib/smartboard/presentationAI/controller.ts` and its wiring in `PresentationView.tsx`:

- `rebuildRowOwnership(lineIdx: number): void` — clears `rowOwners` entries for that line and any note it owned.
- `forceRepaintLine(lineIdx: number): void` — increments a `linePaintNonce[lineIdx]` state used as a React key on the line's row group, forcing remount.
- `getNoteButtonEl?(lineIdx): HTMLElement | null` — returns the preview panel note button so tactics can dispatch synthetic clicks.
- `getHashFabEl?(): HTMLElement | null` and `getChipEl?(lineIdx, fillerIdx): HTMLElement | null` — same idea for floating.

These are read/side-door helpers, not new writing logic — the existing writers already cover all cases.

### 5. Preview panel — expose DOM targets

`PresenterPreviewPanel.tsx`:
- Add `data-note-button data-line-idx={i}` to each Note affordance.
- Add `data-chip data-line-idx={i} data-filler-idx={k}` to each floating chip.
- Add `data-line-reveal data-line-idx={i}` to each line's reveal button.
- No behavior change — only attributes so tactic 3 can dispatch synthetic clicks.

### 6. Share the power with Autoplay

`src/hooks/usePresentationAI.ts` (Autoplay):
- Import `runPipelineRepair(target, ctrl)` from a new shared entry `src/lib/smartboard/manualEdit/pipelineRepair.ts` (thin wrapper over the operator with `forcedCause` derived from the current issue).
- On any repair failure inside Autoplay's existing `runRepair`, escalate to `runPipelineRepair` before marking the issue unresolved. This gives Autoplay the same "keep trying tactics until it lands" behavior as manual Fix Error.
- No UI change to the Autoplay diagnosis panel — the extra tactics show up under the existing repair log.

### 7. Verification — behind-the-scenes tests

The operator's `verify()` in `operator.ts` gets stricter, per-target checks:

- **Note:** `getBoardHasNoteFor(lineIdx)` **and** DOM query for the rendered note row (`[data-board-note-line="N"]`) so a "silent success" (state marked shown but DOM missing) is caught. Add `data-board-note-line` to the Smartboard's note rendering.
- **Chip:** signature match **and** ink DOM presence.
- **Line:** signature match **and** ink DOM presence for the row.

When Verify fails via DOM even though state says success, the operator classifies as `render-empty` and jumps to `forceRepaintLine`.

### 8. Files

**New**
- `src/lib/smartboard/manualEdit/pipelineTactics.ts` — the expanded ladder (tactics 3–7 per target).
- `src/lib/smartboard/manualEdit/pipelineRepair.ts` — shared entry for Autoplay + manual.
- `src/components/smartboard/FixOverlay.tsx` — big-text status overlay on the Smartboard column.

**Edited**
- `src/lib/smartboard/manualEdit/operator.ts` — walk the extended ladder, emit richer events, stricter verify.
- `src/lib/smartboard/manualEdit/strategies.ts` — plug pipeline tactics on top of the current ones per root cause.
- `src/lib/smartboard/manualEdit/dispatch.ts` — no API change, just re-export.
- `src/components/smartboard/AiEditWorkspace.tsx` — replace footer with **Fix Error** button, elapsed timer, status bar, mount `FixOverlay`.
- `src/components/smartboard/PresenterPreviewPanel.tsx` — `data-note-button` / `data-chip` / `data-line-reveal` attributes.
- `src/components/smartboard/PresentationView.tsx` — implement `rebuildRowOwnership`, `forceRepaintLine`, `getNoteButtonEl`, `getHashFabEl`, `getChipEl`; add `data-board-note-line` on rendered note rows; host `FixOverlay`.
- `src/lib/smartboard/presentationAI/controller.ts` — new optional methods declared.
- `src/hooks/usePresentationAI.ts` — escalate failed repairs through `runPipelineRepair`.

**Untouched**
- Notebook data, Preview content, backend, LLM. All fixes remain local, deterministic, additive.

### Out of scope

- Rewriting the note/chip event system. Tactics 3–7 sit *around* the existing pipeline; they don't replace it.
- Any change to lesson content or the Preview's rendering rules.
