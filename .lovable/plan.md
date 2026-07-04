## Fix regressions + rebuild Presenter-Preview → Smartboard as source-of-truth

The last refactor broke normal Smartboard operation. This plan restores original behavior and rebuilds Live Mirror as an opt-in Edit mode on the Presenter Preview, exactly as described.

### Problems observed

1. `AiEditWorkspace`'s "clear board on close" effect fires on **mount** (`open===false`), wiping the Smartboard whenever `PresentationView` renders → Next does nothing, only the cover shows.
2. `CursorScrollbar` is imported but never rendered — the up/down cursor rail is gone.
3. Floating-number hash FAB is present via `AssistantButtons`, but the mirror path used `pickFloatingNumber` (which *solves*) instead of opening the panel to *display* the chips, contradicting the "click # → show all floating numbers, don't solve" requirement.
4. Mirror mode is entered implicitly with a `mode` state inside `PresenterPreviewPanel` but there is no visible **Edit** toggle button in the panel header.
5. Selecting a new item leaves the previously-mirrored ink on the board (mirror only re-runs `clearBoard` at entry, not per selection change in a robust way).

### Fixes

**1. `src/components/smartboard/AiEditWorkspace.tsx`**
- Guard the "close" effect with a `hasBeenOpen` ref so `clearBoard` runs **only** when actually transitioning from open → closed, never on mount.
- On selection change while open, always call `clearBoard(controller)` before `applyMirror`, so the previous highlight's ink disappears the moment a new item is picked.
- On Exit, in addition to clearing, call `controller.resetBoard?.()` and reset beat cursor to the current live beat so normal playback resumes cleanly.

**2. `src/components/smartboard/PresentationView.tsx`**
- Render `<CursorScrollbar>` inline on the left rail (below the assistant buttons), wired to the existing sensor up/down handlers — restores the disappeared cursor controller.
- Do **not** mount `AiEditWorkspace` when `mirrorActive===false` (already the case; verified `open={mirrorActive}` — combined with fix #1 this makes the workspace fully inert until the teacher enters Edit mode).
- No other Smartboard control-flow changes: Next, Prev, autoplay, floating-number panel, notebook reveal, and all other affordances stay exactly as they were.

**3. `src/lib/smartboard/manualEdit/mirror.ts`**
- `floating-number` case: replace `ctrl.pickFloatingNumber(...)` with `ctrl.openFloatingPanel?.(idx)`. Clicking the # on a preview line will now **open the FloatingNumberPanel** showing all chips for that line — it will not write ink or solve.
- `teacher-note` case: keep the existing note-write path (already writes the note on the board via `writeProseLineOnBoard` + `markNotebookShown`).
- `question` / `solution-line` / `cover` / `section` / `subsection`: keep 1:1 write behavior unchanged.
- `clearBoard` unchanged (already calls `resetBoard` + `closeFloatingPanel`).

**4. `src/components/smartboard/PresenterPreviewPanel.tsx`**
- Add a visible **Edit / Done** pill in the panel header (next to the existing "Following teacher" indicator) that toggles `mode` between `"normal"` and `"edit"`. When toggled to `"normal"`, `onMirrorChange(false, null)` fires and the board clears + resumes normal playback.
- Split each solution line in Edit mode into two clickable regions with visible affordances:
  - **`#` handle** (left, styled like the existing FloatingChips border) → selects `{ kind: "floating-number", beatId, lineIdx, fillerIdx: 0 }`.
  - **Note pill** (right, the existing `NoteBlock`) → selects `{ kind: "teacher-note", beatId, lineIdx, text: notebook }`.
  - Selecting one deselects the other (the existing `selectTarget` toggle handles this).
- Cover / prose sections / question line: single clickable region per item (unchanged).
- In Normal mode the split is not shown; the preview reads exactly as before.

### Acceptance checks

- Open a lesson: cover renders on the Smartboard; **Next** advances beats normally through Introduction → Example 1 → …
- Open Presenter Preview: highlight follows the live beat; Next still works.
- Click **Edit** in the preview header: enter Live Mirror; Smartboard clears.
- Click Introduction card → prose appears on board. Click Example 1 → Example 1 question appears (previous ink gone). Click a solution line's `#` → FloatingNumberPanel opens showing the chips (no equation written). Click the same line's Note → note text writes on the board (chips close).
- Click **Done** in the preview header: Smartboard clears, normal playback resumes from the current beat, Next works again.
- Cursor up/down rail is visible on the left. Floating-number # FAB is visible on the right.

### Out of scope

- No changes to lesson-note generation, backend, floating-number generator, plan storage, autoplay logic, or math rendering.
