# Academia: only schools create it; personal workspaces see the student view

## What I understood
- **Only a school account can create an Academia.** The school administrator creates Classes and Subjects and gives each Subject to a teacher.
- **Teachers build inside the school's Academia:** Topics, Subtopics, Sessions and Activities, and only in the Subjects they were given. A teacher linked to 10 schools can build in all 10 of those school Academias.
- **In a teacher's personal workspace there is no "My Teacher workspace Academia."** You can't add a class there and you can't edit the presentation there.
- **In a personal workspace, Academia looks exactly like it does for a student**, and the same as in the Academia app (its latest look). It lists the Academias you can open.
- **On top of the student view, a teacher also gets:** Reports, Smartboard, and the lesson notes uploaded by whoever created the Session. Students don't get these.
- **The app stays login-free.** No teacher login gets added to it.

## Changes
1. **Personal workspace Academia page:** replace the builder (Classes, Subjects, Topics, Subtopics, Sessions panels, Edit presentation, Change cover) with the same browsing screen students use, styled to match the app.
2. **Teacher extras on that screen:** when a teacher opens a Session, they see Reports, Smartboard and the creator's lesson notes. A student opening the same Session sees none of these.
3. **School workspace (when a teacher switches to a school):** keeps today's builder, limited to the Subjects that school gave the teacher.
4. **Stop creating personal Academias:** from now on, opening Academia in a personal workspace never creates one. Building one in a personal workspace is also blocked at the server, not just hidden.
5. **Existing personal Academias** (like "My Teacher workspace Academia") disappear from view. Nothing gets deleted, so no data is lost.
6. **Student view:** updated to the same look as the app, so students and teachers in personal workspaces see the same thing.

## Technical details
- `TeacherAcademiaPage`: when `personal`, render `StudentAcademiaView` (aligned with `AcademiaScreens` from the app) plus a teacher-tools slot. Remove `academiaForWorkspace(..., personal=true)` auto-creation.
- Session page: teacher tools gated by role teacher (not by `canBuild`). Building stays gated by school subject assignment (`academia_can_build_subject`).
- Database: a migration blocks inserting `academia` rows for non-school organisations. Existing rows are left alone and hidden from discovery.
- Update the `AGENTS.md` rule that currently says personal workspaces own a Personal Academia.
- Tests: personal workspace can't create an Academia; teacher tools are shown to teachers only.
