# Students can open the courses assigned to their class

## What's wrong

The assignment worked: "Algebra mile" is attached to class kg1. But the course itself is still a **draft**, and the database only lets a signed-in user read a course (plus its sections and blocks) when it is **published** or when they own it. So on the student side the pathway row loads, the course record behind it comes back empty, and the row is dropped — the student sees nothing.

This is confirmed: the only assignment in the database points at a course with status `draft`, and the read rules on `courses`, `course_sections`, and `course_blocks` are owner-only or published-only.

## The fix: assignment grants access

Assigning a course to a class becomes the permission itself, so a teacher never has to publish a course to teach it.

1. Add read access for class members: a student (or the class owner) may read a course, its sections and its blocks whenever that course is assigned to a class they belong to — regardless of draft/published status. Existing owner, published and school rules stay untouched.
2. Student Courses page: keep the existing pathway, learning-mode and lock behaviour, but replace the silent empty state with an honest one — if a pathway row exists whose course cannot be loaded, show "This course isn't available yet — ask your teacher", instead of hiding the row.
3. Teacher Courses page: show a small "Draft — visible to this class" note on draft rows so the teacher knows students can already open it.

## Technical notes

- One additive migration: three `CREATE POLICY` statements (SELECT, `TO authenticated`) on `public.courses`, `public.course_sections`, `public.course_blocks`, each testing membership through `class_course_assignments` joined to the existing `is_class_member` / `is_class_owner` helpers. Wrapped in a `SECURITY DEFINER` helper `public.course_assigned_to_my_class(_course_id uuid)` to avoid recursive policy evaluation across the join. No table changes, no grants needed (tables already granted).
- `src/lib/courses/classCourses.ts`: `listClassCourses` stops silently filtering rows with a null course join; it returns the row with `course: null` so the UI can explain the gap.
- `src/pages/student/StudentCoursesPage.tsx` and `src/pages/class/ClassCoursesPage.tsx` render the new states.
- No change to progress, locking, or the course runtime.
