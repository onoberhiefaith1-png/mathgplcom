# Academia single-question Play, designed Question cards, then a finished Staff Hub

## Part 1 — Academia: one activity = one question, no Levels

What I found:
- Academia Play opens the Game for the teacher's hidden Academia class and loads **every** board compiled for that class. Each question sent through the same Game becomes another Level, so students see a Level set instead of the one question they picked.
- When a question is sent to a Session, the app looks for an existing card on the same lesson note and may **update it** instead of adding a new one. That's why repeated sends don't always make Activity 1, 2, 3…

Changes:
1. **Play opens only that card's question.** When a Game is opened from Academia, only the board for that card's question loads. The Level map, Level picker and "next Level" step are hidden. Finishing the question ends the play and returns to the Session. Normal Games keep their Levels exactly as they are.
2. **Every send makes a new card.** Each question sent to a Session, including through the same Game, becomes its own card: Question 1, Question 2, Question 3… Only sending the *exact same* question again to the same Session refreshes its card, so you don't get accidental duplicates.
3. **Cards say "Question", not "Activity".** This applies to the Session page, the student view, the guest Session link, and Practice/Play page titles.
4. **Designed question card.**
   - When a question is sent, AI turns the saved question text into a clean, bold card: the instruction on top (for example "Solve for x") and the equation big and centred, set properly as maths (x + 5 = 15). The question itself is never changed. It is copied word for word, following the existing question-lock rule.
   - The teacher can upload a picture for a card. The picture then replaces the designed layout.
   - Existing cards get designed the first time a teacher opens the Session.
   - Students see the designed question before they choose Practice or Play. The Practice/Play page shows it at the top.
5. Practice stays one question, with unlimited retries and no deadline, as it works today.

## Part 2 — Finish Staff Hub

This completes the Staff Hub brief so it's ready to present.
1. **Look.** Staff Hub gets polished dashboard styling: headline numbers, a status board (Assigned, In progress, Submitted, Changes requested, Completed, Overdue), clear status and priority badges, due-soon and overdue highlights, empty states and loading states. It works on phone and tablet too.
2. **Overdue handled automatically.** Tasks past their deadline switch to Overdue, and the teacher and managers are notified.
3. **Evidence from MathGPL itself.** When a task is linked to a lesson note, Academia Session, Game or assignment, real events on that item are recorded as evidence on the task, such as "note edited", "3 questions added" or "assigned to Class 2". These appear next to the uploaded proof.
4. **AI assessment of a teacher's work.** A new "AI review" button on a submitted task, plus a per-teacher "AI performance report" for any period.
   - The AI reads only real records: task briefs, deadlines, proof notes, files listed, review rounds, extensions, comments and MathGPL evidence.
   - It gives a structured verdict: delivery vs brief, timeliness, quality signals, strengths, concerns and suggested next steps. Every point cites the records it came from.
   - It never invents facts. If something wasn't recorded, it says so.
   - Reports are saved, can be printed or exported, and are clearly labelled as AI-assisted. The manager's approve or decline decision stays human.
   - Cost stays low: it runs once per click and is saved, never automatically in the background.
5. **Weekly summary.** Each manager gets an optional one-click summary for the week: completed, late, at risk and overloaded teachers.
6. **Checks.** I'll sign in as the school and as a teacher in the preview and run the full cycle: assign, start, submit proof, AI review, approve, report. Then I'll fix anything that breaks.

## Technical details

- `GamePlayPage`: when opened with the `academia` query, load the activity and filter `boards` to the one whose question matches `academia_activities.subsection_id` / `question_key`. Add a `singleQuestion` flag that hides the level map/next-level UI in the runtime.
- `assignToAcademia`: find an existing card only when `subsection_id` matches exactly. Otherwise, insert a new card at `position = count`.
- Migration: `academia_activities.question_design jsonb` (instruction, math, ai_generated_at) and `question_image_path text` (image stored in `academia-media`).
- New server function `designAcademiaQuestion` using Lovable AI (`openai/gpt-6-astra`) with a verbatim-lock check. On a mismatch, it falls back to plain rendering.
- Staff Hub:
  - Migration for the `staff_ai_reports` table (org, subject_user, task nullable, period, content jsonb, cited ids), with GRANTs and RLS limited to managers.
  - A `staff_mark_overdue()` function that runs on page load plus a scheduled job.
  - Triggers or client hooks that write `staff_work_events` for linked items.
  - Server functions `staffAiReviewTask` / `staffAiTeacherReport` using `requireSupabaseAuth` and a manager check. They handle errors 402, 429 and 403.
- Update AGENTS.md and roadmap.md. Run the typecheck and tests, and verify in the browser.
