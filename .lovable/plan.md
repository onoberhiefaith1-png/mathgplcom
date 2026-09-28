# Student Academia, Assign-as-Academia, and editable names

## 1. Assign as Academia (Shared Workspace only)
- Lesson Note "Assign" window: in a **Shared Workspace**, the choices become **Academia (first) → Assignment → Game → Adventure**. Courses is removed there. In the **Personal Workspace** nothing changes (Assignment, Game, Adventure, Course).
- Choosing Academia opens a step-by-step picker, each step from what already exists:
  1. **Academia** — the school's Academia name, shown but locked.
  2. **Class**
  3. **Subject** — only the Subjects this teacher is assigned to.
  4. **Topic** (scrollable list) → 5. **Subtopic** → 6. **Session**
  7. **Game (optional)** — only games created in that Shared Workspace.
- Press Assign: the lesson note's questions (with their Floating Numbers) are placed in that Session, plus the game if one was chosen.

## 2. Session page change
- Remove the "Add activity" link that lists every material in the system. Content only arrives through Assign as Academia. Teachers can still reorder or remove what's there.

## 3. Practice and Play cards
- Opening a Session shows two big, well-designed cards side by side:
  - **Practice** (left): the assigned questions, just like an Assignment.
  - **Play** (right): the chosen game. It only shows if a game was attached; otherwise Practice is the only card.
- The School, Teachers and Students can all open a Session and practise or play. This also fixes the School's Sessions not opening.

## 4. Student Academia
- Student menu: add **Academia** between Learning and Connections. The right-hand menu also gets **Academia** after Building. Learning, Assignments, Adventure and Courses stay as they are.
- Follows the approved design:
  - With no Academia yet: an empty state with Add and Explore.
  - Otherwise: a carousel of three cards with Explore and Continue Learning, and a table of Previous Activities.
  - Inside: Classes → Subjects → Topics → Subtopics → numbered Sessions, with search.
- **Record keeping (main focus):** every Practice and Play attempt is saved per student, per Session. Each Session shows Not started, In progress or Completed. The best valid score is the one that counts. Records made in a school's Academia go to that school's reports only; different schools never mix.

## 5. Account names
- On My Account, **Registered name** and **Username** can both be changed. Username (how others see you) comes first.
- In School account settings, the **School name** can be changed. The school's Academia name updates to "<School name> Academia".

## Technical details
- New table `academia_attempts` (session_id, user_id, mode practice|play, score, max_score, status, org_id, timestamps). Students manage their own rows; the school owner and the session's builders can read them. Grants and access rules are included.
- `academia_sessions` gains `notebook_id` and `game_id` (nullable). The Assign step calls an `assign_to_academia` function that checks the teacher's subject assignment on the server.
- Practice reuses the existing assignment runner. Play reuses `/game/play/:id`. Scores are recorded from their existing completion hooks, so there are no new marking rules.
- Viewing is widened with `academia_can_view_org` so school owners, members and enrolled students can open Sessions.
- Name edits go through an RPC that updates the profile's display name. The school name is edited on `organizations.name`, restricted to the owner.
