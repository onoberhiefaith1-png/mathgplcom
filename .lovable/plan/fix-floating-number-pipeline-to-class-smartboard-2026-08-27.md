# Fix floating-number pipeline to class Smartboard

## Context
The bottom panel and foldable workspace bar have been removed as requested. The next task is to restore the floating-number pipeline that carries numbers created/saved in a Lesson Note through to the class Smartboard workspace, without redesigning the system.

## What is breaking
The class Smartboard launcher sends `/smartboard/${notebookId}?classId=${classId}`. `SmartBoardPage` records the active notebook in `class_smartboard_state` and `class_lesson_notes`, then mounts `PresentationView`. `PresentationView` loads the notebook via `useNotebook`, which either reads legacy `notebook_sections/blocks/subsections` rows or runs `syncDocumentToNotebook` to rebuild them from `notebooks.document_json`.

Floating numbers live on `notebook_subsections.floating_lines` and `floating_bucket`. If the sync is skipped, fails silently, or the class path reads a stale/no-privilege copy, the reservoirs that feed the board's Floating Number panel are empty.

## What the plan will do
1. Trace the exact path from `document_json` → `syncDocumentToNotebook` → `notebook_subsections.floating_lines/floating_bucket`.
2. Check whether the class launch path (`?classId=...`) triggers the same sync as the normal `/smartboard/:id` path and whether `useNotebook` returns the correct subsection rows for that notebook.
3. Verify the `canEdit` guard in `useNotebook` does not block the sync when a teacher opens a class-shared note they do not own (class launch is teacher-owned or class-shared, so this may be relevant).
4. Add logging or a targeted read to confirm floating data is present in the database for notebooks launched from class.
5. Fix the specific broken connection (e.g. sync not awaited, wrong notebook id, missing reload, RLS/policy issue, or class-shared note treated as read-only) and add a regression test if feasible.
6. Verify with the live preview that floating numbers created in the Lesson Note appear in the class Smartboard Floating Number panel / Presenter Preview.

## What will not change
- No new tables, no new UI, no new pipeline design.
- The removed bottom panel and workspace bar will stay removed.
- The Floating Number display mechanism itself will not be redesigned; only the data connection will be repaired.
