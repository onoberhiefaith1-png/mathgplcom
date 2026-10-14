# One Note per Topic, with Subtopics Inside

Each lesson note becomes a Topic container (e.g. "Surds"). Its subtopics live inside it, so the library stays small (about 20 notes instead of hundreds).

## Create Lesson Note dialog
- Fields: Subject, Topic, Class, Session, Teacher.
- Subtopic field removed.
- Create opens the note straight away.

## Inside the note
- A collapsible Subtopics drawer on the left side, with a `+` button to add a subtopic (e.g. "Addition of Surds", "Subtraction of Surds").
- Clicking a subtopic shows only that subtopic's own pages; clicking another switches instantly; going back restores the earlier work exactly.
- The drawer can be closed for full screen space and reopened any time.
- Subtopics can be renamed, reordered and deleted (delete asks first).
- Until a subtopic exists or is selected, the page shows "Add a subtopic to begin" and Co-Pilot waits.
- Once a subtopic is selected, Co-Pilot works for "Topic — Subtopic".

## Existing notes
- Nothing is lost. An existing note that already has a subtopic opens with that one subtopic in the drawer, holding all its current content.
- Library cards show the Topic plus a subtopic count.

## Technical details
- New table `notebook_subtopics` (id, notebook_id, name, order_index, timestamps) with GRANTs and RLS matching notebook ownership/access.
- Nullable `subtopic_id` on `notebook_sections`; editor filters sections by the selected subtopic. Migration backfills: one subtopic per existing notebook (from `notebooks.subtopic`, or "General"), linking all its sections.
- `notebooks.subtopic` kept for compatibility, no longer edited from the dialog.
- Co-Pilot / notebook-ai requests take the selected subtopic name as context; generation standards themselves unchanged.
- Files: `CreateNotebookDialog.tsx`, `LessonNotesPage.tsx`, `NotebookEditorPage.tsx`, new `SubtopicDrawer` component and `src/lib/lessonnotes/subtopics.ts`.
- Tests for the backfill mapping and subtopic switching/ordering helpers.
