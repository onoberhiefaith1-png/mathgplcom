# Student Questions on the Assessment Card

Student questions stop being notifications and become part of the assignment they belong to. The general notification/broadcast system stays exactly as it is.

## What changes for the student

- The **Ask a Question** button moves from the bottom-left to the **top-right** of the student Smartboard chrome (same button, same short form).
- Sending a question no longer creates a notification. It attaches the question to the assessment card the student is on, plus the exact question they were solving.
- The same panel becomes a small conversation: past questions for this assessment question are listed with the teacher's answer underneath, so a student returning to that question sees the reply in place.

## What changes for the teacher

- Each **Assignment Dashboard** (and Adventure Dashboard, which uses the same card) gains a **Student Questions** section under the status panel:
  - one row per question: student name, which question of the assignment it belongs to, time, and answered/unanswered state;
  - unanswered ones first with a count badge;
  - opening a row shows the full question and a reply box; replying keeps the answer attached to that question.
- Live updates: new questions and replies appear without a refresh.

## Technical notes

**New table `public.assessment_student_questions`**
- `id`, `assessment_id` (FK assessments), `class_id`, `student_user_id`, `board_question_id` (text, nullable — the lesson-note question on the board), `body`, `answer_body` (nullable), `answered_by`, `answered_at`, `created_at`.
- GRANTs: `SELECT, INSERT, UPDATE` to `authenticated`, `ALL` to `service_role`.
- RLS: student may insert/select own rows for a class they belong to (`is_class_member`); class owner/teacher may select all rows for the class and update only `answer_body`/`answered_*` (`is_class_owner`).
- Added to `supabase_realtime` publication for live teacher updates.

**Server functions** in `src/lib/assessments/studentQuestions.functions.ts` (all `requireSupabaseAuth`):
`askAssessmentQuestion`, `listMyAssessmentQuestions` (student, scoped to assessment + optional board question), `listAssessmentQuestions` (teacher, per assessment id list), `answerAssessmentQuestion`.

**Frontend**
- `src/components/notifications/AskQuestionButton.tsx` → repurposed/replaced by `src/components/assessments/AskAssessmentQuestion.tsx`; it now calls the new server fn, renders at `top-4 right-4` (offset clear of existing top-right board chrome), and lists prior Q&A. It is only rendered when an `assessmentId` exists; on a board with no assessment the button is hidden.
- `src/components/smartboard/PresentationView.tsx` — swap the component and its position; nothing else on the board changes.
- New `src/components/dashboards/StudentQuestionsPanel.tsx` used by `AssignmentDashboardPage.tsx` and `AdventureDashboardPage.tsx`, subscribing to realtime for the assessment ids already loaded there.
- `askQuestion` in `src/lib/notifications/notifications.functions.ts` and the notifications "Questions" tab stay in place untouched, so existing history is not lost; no new rows flow there.

**Tests**: unit tests for question grouping/unanswered ordering and for the student-visible answer mapping.
