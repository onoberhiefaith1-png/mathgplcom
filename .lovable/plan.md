# Student Academia Discovery + menu duplication check

## 1. Add and Explore Academias (student page)
Today the student Academia page only shows the Academia of a school the student already belongs to, otherwise "No Academia yet". This changes to the approved design (your first pictures):

- **Empty state**: a friendly card with two buttons, **Add Academia** and **Explore Academias**.
- **Explore Academias**: a full browse page with a search box (search by Academia or school name). It lists every **Public** Academia plus the student's own school Academia, each as a card with its cover picture, logo, name, school name and short description.
- Each card has **View** (look inside: Classes → Subjects → Topics → Subtopics → Sessions, read-only preview) and **Add to workspace**. Inside the View page, **Add to workspace** also sits at the top right.
- **Add Academia** opens the same search, focused for quick adding.
- Once added, the student's Academia page shows:
  - A carousel of three cards at the top: **Explore**, **Continue Learning** (last session opened, with its status), and their added Academias.
  - Inside an Academia: Classes → Subjects → Topics → Subtopics → numbered Sessions, with search, each Session showing Not started / In progress / Completed.
  - A **Previous Activities** table: session, Academia, mode (Practice/Play), best score, status, date.
- Students can remove an Academia from their workspace. Private school Academias never appear in Explore for outsiders.
- Records stay per school: attempts in School A's Academia are only visible to School A.

## 2. Left menu appearing twice
- Open every student page (Learning, Assignments, Adventures, Courses, Classes, Academia, Connections) on desktop, tablet and phone sizes and find where the left menu shows twice.
- Fix it at the source so each page shows exactly one left menu. Nothing else on those pages changes.

## 3. Also switched on
- Practice and Play shown as two large side-by-side cards on the Session page (Play only when a game is attached).
- Game list in "Assign as Academia" limited to games from that Shared Workspace.

## Technical section
- New table `academia_enrolments` (user_id, academia_id, created_at, unique pair) with GRANTs + RLS: the owner manages their own rows.
- New security-definer read `discover_academias(q text)` returning public Academias (plus the caller's school ones) with name, school name, description, cover/logo paths; search by ILIKE on names. `academia_can_view_org` widened so enrolled students can read a public Academia's tree and sessions.
- Cover/logo pictures for public Academias are shown through signed links, allowed for public Academias in the `academia-media` read policy.
- `myAcademias()` becomes: school Academias + enrolled ones. New components: `AcademiaExplore`, `AcademiaCard`, `AcademiaPreview`, carousel + history in `StudentAcademiaView`. New routes `/student/academia/explore` and `/student/academia/$academiaId` with their own titles.
- Duplicate menu: diagnosis not yet confirmed; first step is a Playwright pass across student routes at 3 widths to locate the double render (suspect a page rendering its own sidebar inside `StudentShell`/dashboard layout), then remove the duplicate.

## Verification
- Signed in as a student: empty state → Explore → search → View → Add to workspace → Academia appears in carousel → open Session → Practice → record shows in Previous Activities.
- Screenshots of each student page confirm one left menu.
