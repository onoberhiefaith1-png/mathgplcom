
# Fix "View Student Work" — live mirror, shared editing, reasoning panel

## What exists today (verified)
- `TeacherAssessmentViewerPage.tsx` mounts a **separate** `PresentationView` built from the assessment source. It is a second, independent board — not the student's board.
- `PresentationView.tsx` already has: `canEdit` gating for view-only mirrors, class-scoped live sync (`useSmartboardSync` → `class_smartboard_state`), a student-side broadcast on `assessment-live-<assessmentId>-<studentId>` that carries only ASCII (not full board state), silent auto-check on line-leave, and the manual `checkActiveLine`.
- `checkActiveLine` still hard-blocks with the old rule at line ~2888: `"Finish the line" / "Make sure it's a complete equation (both sides of =)"`. The same `=`-shape gate also exists in `silentAutoCheckLine` and in the line-status colouring.
- `grade-line` edge function already does equivalence + floating-token subset checking and supports `persist:false` dry runs.
- Presenter Preview chrome is gated on `isTeacher && notebookId`, and `isTeacher` is false in assessment mode — so the teacher can't open Presenter Preview while reviewing.

## 1. One shared board session (live mirror)
Introduce a per-(assessment, student) shared session used by **both** the student board and the teacher viewer:
- Durable state: additive migration creating `assessment_board_state` (assessment_id, student_id, state_json, active_line_idx, question_id, author, updated_at) with grants + RLS (student owns their row; class owner may read and write). No existing table is touched.
- Low-latency channel: reuse/extend the existing `assessment-live-<assessmentId>-<studentId>` broadcast to carry the **full board snapshot** (`freeLines`, `smartLines`, `boxes`, `sensor`, `zoom`, `bandExtra`, `lineOffsets`, surface/profile/ink, `activeLineIdx`, `questionId`) rather than ASCII only. Debounced, echo-suppressed by `author`.
- On mount, both sides load the DB row (so the teacher sees prior work even if the student is offline), then follow broadcasts.
- New `PresentationView` props: `mirrorStudentId`, `mirrorRole` ("owner" | "observer"), `viewOnly`. Reuse the existing `applyingRemoteRef` apply-path so remote snapshots never re-broadcast.

Result: student writes → teacher sees it instantly; zoom/pan/line changes propagate; one state, never two.

## 2. View Only mode (teacher)
`viewOnly` forces `canEdit = false` (already suppresses keyboard, pointer edits, carriers and tool chrome). The teacher chrome is reduced to: Back, game/assessment title, line navigation, progress (n/total), Zoom, Edit toggle, Reasoning toggle. Everything else hidden.

## 3. Edit mode (teacher)
Toggling Edit sets `canEdit = true` and makes the teacher an author on the same session: teacher edits broadcast + persist to the same row, and the student applies them (student stays editable throughout). Last-writer-wins with author echo suppression, same mechanism as the class mirror already uses.

## 4. Presenter Preview
Allow the Presenter Preview split pane in assessment mode **for teachers only**: change the gate from `isTeacher && notebookId` to `role === "teacher" && notebookId` (assessment source carries the notebook). Students keep Present Mode only — Normal Mode stays teacher-side, unchanged.

## 5–8. Reasoning panel
- Reasoning button toggles a right panel at ~20% width that **pushes** the board (flex sibling, no overlay); board takes the remaining ~80%. Fix the current inverted widths in `TeacherAssessmentViewerPage.tsx` (today the board gets 20% and the panel 80%).
- Panel shows **only the current line** (driven by the mirrored `activeLineIdx`), not a list:
  - `Line N`
  - **Expected equation** — read from the answer key / Presenter-Preview Normal-Mode aligned line for that lineId. Never generated.
  - **Student line** — the mirrored ASCII exactly as constructed: no reordering, simplification or reformatting.
  - **AI Evaluation** — verdict text + mark state, from `grade-line` in `persist:false` dry-run mode; explicit callout when the student used tokens outside the line's floating set.
- Teacher-only; nothing about it renders on the student board.

## 9–12. Checking rules
- **Remove the `=`-shape gate entirely** in `checkActiveLine`, `silentAutoCheckLine`, and the line-status colouring: delete the `eqIdx/lhs/rhs/dangling → "Finish the line"` block and the equivalent early-return. Completion is judged by the grader, not by the presence of an equals sign.
- **Automatic silent marking** (line-leave): unchanged behaviour — equivalence + floating-set subset → award silently; otherwise nothing, no toast, no error styling.
- **Manual Check**: keeps teaching feedback, but sourced from the grader verdict instead of the old syntax rule — "Incomplete expression", "Uses a number that wasn't provided", "Not mathematically equivalent", "Missing component".
- Yellow/red rail status recomputed from grader-backed state rather than `=` shape.

## Files
- `src/components/smartboard/PresentationView.tsx` — shared-session sync, mirror props, view-only chrome, presenter gate, removal of the old equation checker, grader-based manual feedback.
- `src/components/smartboard/TeacherReasoningPanel.tsx` — current-line-only layout, expected/student/evaluation blocks.
- `src/pages/class/TeacherAssessmentViewerPage.tsx` — correct 80/20 split, View Only ⇄ Edit toggle wired to the shared session, reduced chrome.
- `src/pages/student/AssessmentBoardPage.tsx` — pass session identifiers.
- `src/components/smartboard/LineStatusRail.tsx` — status semantics comment/logic.
- One additive migration for `assessment_board_state`.
