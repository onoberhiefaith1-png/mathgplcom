# MathGPL Academy — School, Teacher and Student Upgrade

Connect the existing systems (schools, teachers, students, shared workspaces, courses, games, questions) into one Academy: a ready-made curriculum a School builds once, Teachers fill in, and Students discover and learn from. Nothing that works today is rebuilt. Your six pictures are the visual reference.

## Who does what

```text
School (in its own dashboard)      -> creates Classes and Subjects, assigns Subjects to Teachers, views everything
Teacher (in that School's shared   -> sees all School Classes + only their assigned Subjects,
         workspace)                   creates Topics, Subtopics, Sessions, Activities
Teacher (personal workspace)       -> discovers Academies like a student, learns, and can Assign a Session to own class (via Courses)
Student                            -> adds Academies, Explores, Continues Learning, sees Previous Activities
```

- One Academy per School, named automatically ("My School Academy"). No "Create Academy", no "Which Academy?" step.
- Many teachers can build the same Subject together; a teacher can have many subjects.
- School A and School B content and reports never mix, even for the same teacher. A teacher's own assignments report to that teacher only.

## Phase 1 — School side (picture 2)
- Add Academy to the School Console menu (Dashboard, Building, Academy, Teachers, Students, Reports) and as the first Quick Action and tile. No other dashboard changes.
- School Academy page: four columns Class → Subject → Topic → Subtopic (picture 5 layout). School gets Add Class and Add Subject only, plus "Assign teachers" on each subject. Topics and below are view-only for the School.
- Academy Settings: visibility (Private to school / Public) and "Allow teachers to assign Academy content".

## Phase 2 — Teacher in the shared workspace (pictures 5 and 6)
- Academy in the shared-workspace menu opens that School's Academy directly.
- Classes shown read-only; only assigned Subjects shown; Add Topic / Add Subtopic / Add Session / Add Activity available.
- Session page (picture 6): fixed video on the left, scrollable reorderable Activities on the right, session tabs, breadcrumb, Practice / Play (when a game is attached). Activities reuse existing Questions and Games.
- Lesson Notes Assign in the shared workspace gains "Academy" as a destination (personal Lesson Notes unchanged).

## Phase 3 — Student Academy (pictures 1, 3, 4)
- Academy in the student menu: empty state with Add Academy / Explore Academies, then the three-card carousel with Explore and Continue Learning, and the Previous Activities table.
- Inside an Academy: Classes → Subjects → Topics → Subtopics → numbered Sessions, with search.
- Not started / In progress / Completed states; progress saved; Practice and Play scores are not added — the best valid score counts.

## Phase 4 — Teacher personal Academy + reports
- Same discovery experience as students, with the teacher's own progress, plus "Assign Session" to one of the teacher's classes, delivered through the existing Courses.
- Reports: school-context learning goes to the School report; a teacher's own assignment goes to that teacher's report only.

## Before I start — please confirm
1. The current Academy is a 3D "world" with Rooms and Categories. I plan to keep that data and reuse it: Room = Class, Category = Subject, and keep Topic and Subtopic as they are. Any existing rooms stay visible.
2. Build in the four phases above, one at a time, starting with Phase 1.

## Technical notes
- Reuse `academies` (one per school `org_id`), `academy_rooms` (Class), `academy_categories` (Subject), `academy_topics`, `academy_subtopics`. Add columns `academies.visibility`, `academies.allow_teacher_assign`.
- New tables (GRANTs + RLS each): `academy_subject_teachers` (subject ↔ teacher, many-to-many), `academy_sessions` (subtopic, title, video, order), `academy_session_activities` (session, question/game reference, difficulty, order), `student_academies` (learner's added list), `academy_progress` (user, session/activity, status, best score, context org/class for reporting).
- RLS via security-definer helpers: school owner edits Class/Subject; assigned teachers (active shared-workspace membership + subject assignment) edit Topic and below; viewers limited by visibility.
- Session assign creates a class course through the existing Courses engine; no second course system.
- Record the Room=Class / Category=Subject mapping in `AGENTS.md`.
