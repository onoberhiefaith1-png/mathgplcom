## Goal

1. Students get the Presenter Preview panel on their Smartboard — but **Present mode only**, never Normal mode (no answers).
2. Teacher "View Student Work" shows the Preview too (already teacher-enabled), and the **Check** button disappears in View Only mode, returning when Edit mode is on.

## Current state (verified)

- `PresenterPreviewPanel.tsx` holds `mode: "normal" | "edit"` (line 190). Confusingly, `"edit"` is the **Present mode** ("click any item to send it to the Smartboard") and `"normal"` is the answers view. A toolbar toggle at lines 495–524 flips between them; default is `"normal"`.
- `PresentationView.tsx` line 294: `showPresenterChrome = isTeacher && (!!notebookId || assessmentMode)` — the 30% split pane and the top-left icon are teacher-only.
- The per-line **Check** pill (bottom-right, lines ~5543+) renders whenever `hasGuidedLines` is true, regardless of `viewOnly`.
- `TeacherAssessmentViewerPage.tsx` passes `viewOnly={!editMode}` but no `notebookId`; `AssessmentBoardPage.tsx` passes no `notebookId` either, though the assessment row already selects `notebook_id`.

## Changes

**1. `PresenterPreviewPanel.tsx` — present-only lock**
- Add prop `presentOnly?: boolean`.
- When true: initialise `mode` to `"edit"` (Present), ignore/force it so it can never become `"normal"`, and hide the mode toggle button. Header label reads "Present mode — click any item to send it to the Smartboard".
- Every `mode === "normal"` branch (answer equations at line 719, `AiEditButton` at 802, the normal-mode block at 467) stays off automatically, so no solutions leak.

**2. `PresentationView.tsx` — student access + Check gating**
- Change the chrome gate to `showPresenterChrome = (isTeacher || role === "student") && (!!notebookId || assessmentMode)`. Same top-left icon (10s auto-hide) and same 30% split pane for both roles.
- Pass `presentOnly={!isTeacher}` to `PresenterPreviewPanel`.
- Keep the `data-sb-teacher-only` attribute off the student-visible instances so existing teacher-only hiding rules don't strip it.
- Wrap the bottom-right **Check** pill (and its dropdown) in `canEdit` so it is hidden whenever `viewOnly` is on, and reappears in Edit mode. Students in a live assignment keep it (they are not view-only).

**3. Wire the notebook id so the preview has content**
- `AssessmentBoardPage.tsx`: pass `notebookId={assessment.notebook_id}` to `PresentationView`.
- `TeacherAssessmentViewerPage.tsx`: fetch/pass the assessment's `notebook_id` the same way so the teacher's preview panel loads on that page too.

## Notes

- No backend/schema changes; nothing about grading logic changes — the Check button is only hidden, not removed.
- Auto-silent line checking stays as-is.
