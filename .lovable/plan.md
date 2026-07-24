
# Complete the Teacher Reasoning Panel (only)

Scope: only `TeacherReasoningPanel.tsx`, its data feed in `PresentationView.tsx`, and the panel slot in `TeacherAssessmentViewerPage.tsx`. No View/Edit-mode work, no new checking engine, no other feature.

## What already exists (verified)

- The Reasoning button is wired: it toggles a right-side 20%-width panel that pushes the board left (`TeacherAssessmentViewerPage.tsx`), and the panel component renders Expected / Student / AI evaluation for a single line.
- The teacher's correct line is stored server-side in the answer-key table and is the source `grade-line` compares against (the assessment on screen has 3 stored key lines). The teacher is allowed to read that key and the student's progress.
- The student's board already broadcasts `questionId`, `activeLineIdx`, `lineIds`, per-line ASCII and per-line floating tokens; manual Check and silent auto-check both already call `grade-line`.

So the panel is not missing an engine — its feed is fragile. That is what this plan fixes.

## Problems to fix

1. **Panel stays on "Waiting for the student's board…"**
   - The snapshot is sent through a ref-held channel; the send effect never re-runs when the channel finishes subscribing, so nothing is published until the student happens to type again.
   - There is no fallback: if the student is idle, offline, or the broadcast is dropped, the panel has no data at all — even though the durable board-state row (question id, active line index, board snapshot) already exists in the database.

2. **Live marks may never refresh.** The panel's progress subscription joins a *private* realtime channel, but the project currently has **no realtime authorization policies at all**, so private joins are the wrong mechanism here. The panel needs a feed that is guaranteed to work.

3. **Evaluation display is thin.** It shows equivalent / not equivalent, but not: an explicit "Waiting…" state, which tokens fell outside the line's floating set, or whether the last result came from the student's own Check vs the panel's live dry run.

## Implementation

### A. Make the student's feed reliable
- Track channel readiness in state (not a ref) so the first snapshot is published as soon as the channel subscribes, and re-published on reconnect.
- Add a small heartbeat: re-publish the current snapshot every few seconds while the student's assessment board is open, so a teacher who opens the panel mid-session immediately gets the current line.
- When the student's manual Check or silent auto-check returns, broadcast a `check` event carrying `{ questionId, lineId, mode: "manual" | "auto", correct, verdict, marks }`.

### B. Add a durable fallback source
- On open, and whenever no broadcast has arrived for a few seconds, the panel reads the persisted board-state row for this (assessment, student) to recover `question_id`, `active_line_idx` and the line ASCII, and subscribes to row changes on that row.
- Broadcast always wins when present; the stored row only fills the gap. The panel shows a small "live" vs "last saved Xs ago" indicator.

### C. Single-line rendering (page-per-line)
- Keep exactly one line visible: the student's current line derived from `activeLineIdx` → `lineIds[idx]`.
- When the student moves, the panel replaces the content immediately (no history, no list) and resets the evaluation to "Waiting…".
- Header shows `Question N · Line M`.

### D. Panel content
- **Expected Line** — the stored teacher solution for the current line (the same one `grade-line` grades against). Never generated in the panel.
- **Student's Current Line** — mirrored verbatim, no reordering, simplification or reformatting.
- **AI Evaluation** — `Waiting… / Equivalent / Not Equivalent`, plus:
  - reason text mapped from the grader verdict (not equivalent, token outside the floating set, unparseable, incomplete),
  - awarded mark vs the line's available mark,
  - a badge showing whether the last verdict came from *live dry run*, *student Check*, or *auto check on line-leave*.
- **Floating numbers for this line** — the allowed token chips, with any student token that is not in the allowed set highlighted as invalid.

### E. Marks / progress feed
- Replace the private-channel progress subscription with the same authenticated path the rest of the panel uses: refresh the student's progress row on each incoming `check` event and on a light interval while the panel is open, so the awarded mark updates the moment a line is credited.
- No grading is performed by the panel itself with persistence — panel grading stays a dry run (`persist: false`); marks are only ever written by the student's Check or auto-check, exactly as today.

### F. Panel shell
- Keep the 20% width, min width, close button, and the push-not-overlay layout already in place; add a scroll-free compact layout since only one line is shown.

## Out of scope
View Only / Edit mode behaviour, co-editing, reports, presenter-preview changes, progress-circle redesign, and any change to the equivalence engine or the grade-line contract beyond reading it.

## Verification
- Open a student board and the teacher viewer side by side in the preview: confirm the panel populates within ~1s of opening (even with an idle student), follows line changes, mirrors ink verbatim, flags an out-of-set token, and updates the awarded mark right after the student presses Check.
