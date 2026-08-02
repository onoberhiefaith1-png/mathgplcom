# Courses inside the Class Workspace

Courses stay authored in Skill Builder (Course Builder). The class gains a **Courses** section that only assigns, orders and sequences existing courses — never creates or copies them.

## What gets built

### 1. Teacher: Class Courses workspace
New page at `Class → Courses` (tile added to the class dashboard, alongside Students / Lesson Notes / SmartBoard / Reports).

- Empty state: "No courses have been assigned." with a single **Assign Course** button.
- Assign Course opens a **selector** (not an editor): searchable list of every course this teacher owns, showing title, subject/topic and status. Selecting one inserts it at the end of this class's pathway. Courses already in the pathway are shown as "Already assigned".
- Pathway list is numbered in learning order, with drag-and-drop plus **Move Up / Move Down** buttons (keyboard/touch friendly) and **Remove from class** (removes the reference only; the course itself is untouched).
- **Learning Mode** control at the top: **Sequential** or **Free**, saved per class.
- Each row links to the course in Skill Builder for editing (single source of truth).

### 2. Assign from the Course Builder side
On a course in Skill Builder, an **Assign to Class** action lists the teacher's classes; picking one adds the reference and navigates straight into that class's Courses workspace — the workflow described in the brief.

### 3. Student: My Courses
Inside the student's class (`/student/class/:classId/courses`, plus a tile/bottom-bar entry), students see only the teacher's pathway:

- Free mode: every assigned course open.
- Sequential mode: completed courses marked done, the next one active, later ones locked with a lock badge and a short "Complete <previous course> first" note. Locked cards are not clickable and the route itself refuses entry.
- Opening a course runs the existing course runtime (sections/blocks student view), read-only for the student.

Progress rules for this phase: a course counts as **completed** when the student marks its Conclusion block complete (or, for a course with exercises, when every exercise block is marked done). Automatic marking against the pass mark and certificates stay out of scope here — they belong with the student runtime/marking work.

## Technical notes

Additive migration only, three new tables in the public schema (each with GRANTs then RLS then policies):

- `class_course_assignments` — `id, class_id, course_id, display_order, created_at`, unique `(class_id, course_id)`. Teacher (class owner) manages; class members can SELECT.
- `class_course_settings` — `class_id` PK, `learning_mode ('sequential'|'free')`, `allow_revisit`, `updated_at`. Owner writes; members read.
- `student_course_progress` — `student_id, class_id, course_id, status, progress, score, certificate_status, started_at, completed_at`, unique `(student_id, class_id, course_id)`. Student reads/writes their own rows; class owner reads all rows for their class.

RLS uses the existing class-membership helper used by the other class tables (verified pattern: owner check via `classes.owner_id`, member check via the class members table), so no new security-definer function unless the membership helper is missing.

Front-end:
- `src/lib/courses/classCourses.ts` — assignment CRUD, reorder, settings read/write, progress read.
- `src/pages/class/ClassCoursesPage.tsx` (teacher) and `src/pages/student/StudentCoursesPage.tsx`, plus `AssignCourseDialog.tsx`.
- Routes: `src/routes/teaching-hub/classes/$classId/courses/index.tsx`, `src/routes/student/class/$classId/courses/index.tsx`, and `.../courses/$courseId/index.tsx` for the student course runtime.
- Class dashboard tile added in `ClassDashboardPage.tsx`; wording follows the existing product-terms helper so the Live workspace keeps its own vocabulary.

Reordering writes `display_order` for the affected rows in one batch; assigning never duplicates course, section or block rows.
