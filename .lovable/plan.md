# Course Builder — Phase 1

A fifth tile joins Lesson Notes, SmartBoard, Classes and Adventure in the Teaching Hub: **Course Builder**. Phase 1 delivers the teacher-side authoring experience end to end, with a live Student View. The student runtime (locked progression, retracement, certificates, notifications) follows in Phase 2 — Phase 1 stores every setting those phases need.

## What you get

### 1. Teaching Hub tile
A new "Course Builder" card ("Build guided courses from your videos and exercises") leading to `/course-builder`. The existing four tiles are untouched.

### 2. Course Library (`/course-builder`)
- Header: title, search box, **+ Create Course**.
- Grid of Course Cards: background thumbnail on top, then title, subject • topic • subtopic, then chips for Sections, Exercises, Students, Pass Mark, then a Draft/Published badge, then View · Edit · Duplicate · Delete.
- Premium white elevated cards on the navy workspace background, matching the class dashboard.

### 3. Split-screen editor (`/course-builder/:id`)
Left = editor, right = **Student View** (labelled exactly that), updating instantly as you type. Three editor tabs:

**Background** — course cover: upload image, upload video, choose from your gallery, or AI-generate. Title, subject, topic, subtopic and description sit on top of it in the preview, with a Begin Course button.

**Sections** — Add Section; rename, reorder (drag), duplicate, delete. Opening a section gives a vertical, freely-ordered stack of colour-coded blocks:
- Video (blue) — paste a link (YouTube/Vimeo/URL) **or** upload a file; shows title and duration; Edit / Replace / Delete.
- Exercise Card (gold) — unique name, topic, subtopic, question count, total marks, pass mark.
- Text / Introduction (white).
- Conclusion (green).

**Settings** — grouped, not one long form:
- Learning Mode: Locked / Unlocked
- Completion Mode: Retracement / Complete by Deadline (deadline days field appears only for Deadline; learning days only for Retracement)
- Pass Mark (%)
- Certificate: Automatic / Teacher Approval
- Publish / unpublish the course

### 4. Exercise Cards get their questions from Lesson Notes
No question authoring inside Course Builder, and no duplicated questions. The existing **Assign** dialog gains a third destination alongside Assignment and Adventure:

```text
Assign To
  • Assignment      (unchanged)
  • Adventure       (unchanged)
  • Course Builder  (new)
        ↓ search + pick Course
        ↓ search + pick Section
        ↓ pick Exercise Card
        ↓ Assign  →  "Lesson Note successfully assigned."
```

The Exercise Card stores a link to that lesson-note question block. SmartBoard and the AI assessment engine are not modified. In the teacher's Exercise Card the linked questions appear as Question 1…n; in Student View they appear with tick marks, progress bar and score placeholders so the teacher sees the real student layout.

## Technical notes

Additive migration only, all owner-scoped RLS plus GRANTs:
- `courses` — owner, title, subject, topic, subtopic, description, background (kind + url), status, `learning_mode`, `completion_mode`, `pass_mark`, `deadline_days`, `learning_days`, `certificate_mode`.
- `course_sections` — course_id, title, position.
- `course_blocks` — section_id, position, `kind` ('video' | 'exercise' | 'text' | 'conclusion'), `config` jsonb (video url/upload/duration; exercise name/topic/subtopic/marks/pass mark).
- `course_exercise_questions` — block_id, position, plus the same `QuestionRef` shape (`subsection_id`, `section_id`, `question_key`) already used by `src/lib/assignments/pipeline.ts`, so the link resolves through existing code.
- Enrolment/progress tables are deliberately left to Phase 2.

New code: `src/pages/CourseBuilderLibrary.tsx`, `src/pages/CourseEditorPage.tsx`, `src/components/coursebuilder/*` (CourseCard, BackgroundEditor, SectionList, block cards, SettingsPanel, StudentView), `src/lib/courses/*` (types + CRUD against the client), routes under `src/routes/course-builder/` guarded by the existing `RequireAuth`, and a `CourseBuilderPicker` step added to `AssignDialog.tsx`. Videos and background files upload to a new storage bucket via the existing storage helpers; each leaf route gets its own head metadata.

## Not in Phase 1
Student course page and progress panel, locked/unlocked enforcement, retracement engine, deadline resets, End Course, certificate editor and generation, notification editor and delivery.
