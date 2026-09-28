# MathGPL Academia — School, Teacher and Student Learning Space

Academia is a brand-new place where a School and its Teachers store ready-made learning activities, organised in a clear order, and where Students (and Teachers) come in to find them and learn. It is a new feature. The existing 3D Building and 3D Academy are not changed, reused or connected in any way.

```text
Academia -> Classes -> Subjects -> Topics -> Subtopics -> Sessions -> Activities
```

Your pictures are the visual reference.

## Who does what

```text
School (own dashboard)             -> owns its Academia; creates Classes and Subjects,
                                      assigns Subjects to Teachers, views everything
Teacher (School shared workspace)  -> sees all School Classes + only their assigned Subjects;
                                      creates Topics, Subtopics, Sessions, Activities
Teacher (personal workspace)       -> finds Academias like a student, learns, tracks own progress,
                                      and (if the School allows) assigns a Session to own class
Student                            -> adds Academias, Explores, Continues Learning,
                                      sees Previous Activities
```

- One Academia per School, created automatically ("<School name> Academia"). No "Create Academia" step.
- Many teachers can build the same Subject together; one teacher can have many Subjects.
- School A and School B content and reports never mix, even for the same teacher. A teacher's own assignments report to that teacher only.

## Phase 1 — School Academia (picture 2)
- Add "Academia" to the School Console menu and as a Quick Action. Nothing else on the dashboard changes.
- School Academia page: columns Class -> Subject -> Topic -> Subtopic (picture 5 layout). School can Add Class, Add Subject and "Assign teachers" per Subject. Topics and below are view-only for the School.
- Academia Settings: visibility (Private to school / Public) and "Allow teachers to assign Academia Sessions".

## Phase 2 — Teachers building content (pictures 5 and 6)
- "Academia" in the shared-workspace menu opens that School's Academia directly.
- Classes read-only; only the teacher's assigned Subjects shown; Add Topic / Subtopic / Session / Activity.
- Session page (picture 6): fixed video on the left, scrollable reorderable Activities on the right, session tabs, breadcrumb, Practice / Play when a game is attached. Activities point to existing Questions, Games, Lesson Notes, Smartboards and Adventures — nothing is copied.
- Lesson Notes "Assign" in the shared workspace gains "Academia" as a destination. Personal Lesson Notes unchanged.

## Phase 3 — Student Academia (pictures 1, 3, 4)
- "Academia" in the student menu: empty state with Add Academia / Explore Academias, then the three-card carousel (Explore, Continue Learning) and the Previous Activities table.
- Inside: Classes -> Subjects -> Topics -> Subtopics -> numbered Sessions, with search.
- Not started / In progress / Completed; progress saved; best valid score counts (Practice and Play scores are not added together).

## Phase 4 — Teacher personal Academia + reports
- Same discovery experience as students with the teacher's own progress, plus "Assign Session" to one of the teacher's classes, delivered through the existing Courses.
- School-context learning goes to the School report; a teacher's own assignment goes to that teacher's report only.

Build one phase at a time, starting with Phase 1.

## Technical notes
- New, separate tables (each with GRANTs + RLS): `academia` (one per school `org_id`, name, visibility, allow_teacher_assign), `academia_classes`, `academia_subjects`, `academia_subject_teachers` (many-to-many), `academia_topics`, `academia_subtopics`, `academia_sessions` (title, video, order), `academia_activities` (reference kind + id to existing question/game/note/adventure, difficulty, order), `academia_enrolments` (learner's added Academias), `academia_progress` (user, session/activity, status, best score, reporting org/class).
- No use of `academies`, `academy_rooms`, `academy_categories`, `academy_topics`, `academy_subtopics`, `academy_placements` or any `/academy` route or 3D component. Those remain as they are.
- New routes under `/academia` (school, teacher, student views) with their own page titles.
- Security-definer helpers: school owner edits Classes/Subjects; teachers with active shared-workspace membership + Subject assignment edit Topic and below; viewers limited by visibility.
- Session assign creates a class course through the existing Courses engine.
- Record in `AGENTS.md`: Academia is a separate learning system; never built on the 3D Academy/Building data.
