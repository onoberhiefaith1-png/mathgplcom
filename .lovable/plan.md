## Presenter Preview — Manual AI Edit Mode

Add a second workflow to the Presenter Preview panel (the panel already embedded next to the live Smartboard in `PresentationView.tsx`) so the teacher can correct any presentation issue directly, without running Autoplay. Presentation AI (Autoplay/diagnosis) stays untouched.

### 1. Two modes on the Presenter Preview panel

Add a mode state to `PresenterPreviewPanel.tsx`: `"normal" | "edit"`. Toolbar in the panel header:

- **Normal (default)** — presentation mode.
  - No text selection (`user-select: none` on the scroller).
  - Every top-level item (cover, prose section, problem, and each solution Line row) shows a small **Skip** pill in its corner. Toggling it writes to the existing skip-plan store (`toggleSkipped` in `src/lib/smartboard/presentation.ts` / the store used by `SmartboardPreviewPage`) so both the teacher panel and Autoplay honour the same flags.
  - No AI Edit affordance.
- **Edit** — activated by an **Edit** button in the top-right of the panel header (pencil icon, toggles to **Done** while active).
  - Skip pills are hidden.
  - Selection re-enabled; hovering any selectable item shows a faint outline.
  - Clicking a selectable target selects it (single-select, replaces previous).

### 2. Selectable targets in Edit Mode

Wrap each renderable unit with a stable `data-edit-target` attribute carrying a typed descriptor:

- `section` (introduction / explanation / summary prose block)
- `example` / `exercise` / `classwork` / `homework` (whole subsection card)
- `question` (the problem statement inside a subsection)
- `solution-line` (one reservoir line row)
- `floating-number` (one chip inside the FloatingChips row)
- `teacher-note` (the NoteBlock)
- `math-structure` (an inline math span inside prose/equation — coarse selection using the parent node)

Selection state lives inside the panel; on select, render an inline **AI Edit** button directly beneath the selected element (absolutely positioned to the selected node's bounding box, or appended as a sibling row so layout stays stable). Only one AI Edit button visible at a time.

### 3. AI Workspace drawer

Create `src/components/smartboard/AiEditWorkspace.tsx` — a slide-in drawer (right side, over the Smartboard column, dismissible) opened when the teacher clicks **AI Edit**. Contents:

- Header showing the selection's descriptor (kind, section caption, line number, subsection id).
- Read-only preview of the selected content (equation, note, chips, etc.), rendered with the same `renderMathInline` pipeline as the panel.
- A prompt textarea with quick-suggestion chips seeded from the common corrections list (missing note, missing floating number, missing line, incorrect spacing, overlapping equations, wrong reveal order, misplaced floating chip, wrong active line, wrong scroll).
- **Apply** and **Cancel** buttons. Apply calls the local edit dispatcher (§4); Cancel closes the drawer and clears selection.

The drawer is hosted from `PresentationView.tsx` so it has access to the same `PresentationController` used by Autoplay/repairs.

### 4. Edit dispatcher — local, no backend

Add `src/lib/smartboard/manualEdit/dispatch.ts`. Given `{ target, promptText }` it:

1. Parses `promptText` against a small intent table (regex + keyword matcher) into one of:
   `sync-note`, `sync-floating`, `sync-line`, `sync-highlight`, `sync-structure`, `fix-spacing`, `fix-overlap`, `fix-order`, `fix-active-line`, `fix-scroll`, `move-note`, `rerender-structure`.
2. Looks up the target's board coordinates via the existing `PresentationController` methods (`scrollBoardTo`, `moveSensorToSafeRow`, `openFloatingPanel`, `pickFloatingNumber`, `writeQuestionLine`, `eraseRow`, `eraseNoteAt`, `setActiveLineIdx`, etc. — already declared in `controller.ts` and `interface.ts`).
3. Reuses the repair recipes from `src/lib/smartboard/presentationAI/repairs.ts` where the intent maps 1:1 to an existing recipe (e.g. `sync-note` → `note-missing` recipe; `sync-floating` → `filler-missing` recipe; `fix-overlap` → `sensor-collision` recipe; `fix-scroll` → `board-scroll-lost` recipe). Only manual corrections that don't match an existing recipe get a new small handler.
4. Returns an `EditReport` `{ ok, actions[], message }` shown in the drawer footer.

Rule (per user): dispatcher **never mutates the notebook / Presenter Preview** — it only drives the Smartboard through the controller. The Preview stays the source of truth.

### 5. Verification

After apply, run a lightweight re-inspection using the existing `inspector.ts` against the affected line only; surface the pass/fail chip in the drawer. On fail, offer a single **Retry** which re-runs the recipe.

### 6. Independence from Presentation AI

- Manual edit dispatcher and Presentation AI share the same controller and repair recipes but do not share run state — pressing Autoplay is unaffected, and using AI Edit while Autoplay is paused or stopped is allowed.
- Presentation AI's issue log stays separate; manual edits log to a new short list in the drawer footer only.

### Files

- edit `src/components/smartboard/PresenterPreviewPanel.tsx` — mode toolbar, Skip pills, selection wiring, `data-edit-target` attributes, inline AI Edit button.
- new `src/components/smartboard/AiEditWorkspace.tsx` — drawer UI.
- new `src/lib/smartboard/manualEdit/dispatch.ts` — intent parser + controller driver.
- new `src/lib/smartboard/manualEdit/types.ts` — `EditTarget`, `EditIntent`, `EditReport`.
- edit `src/components/smartboard/PresentationView.tsx` — host the drawer, pass controller into it, thread selection state.
- reuse `src/lib/smartboard/presentation.ts` skip-plan helpers so Skip pills share storage with `SmartboardPreviewPage`.
- reuse `src/lib/smartboard/presentationAI/{controller,inspector,repairs,interface}.ts` — no changes required unless a new recipe (`move-note`) needs a small addition.

### Out of scope (explicit)

- No changes to Presentation AI (Autoplay), diagnosis panel, or notebook data.
- No new backend or edge functions.
- No LLM call in the workspace drawer — intent parsing is local; a future upgrade could send `{target, promptText, boardSnapshot}` to `notebook-ai`, but this plan keeps everything client-side and deterministic first.
