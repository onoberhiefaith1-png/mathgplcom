## What I found

The `AssignDialog.tsx` and `classAdventures.ts` in this project already match Gameful line-for-line. The real cause of both symptoms you saw is a database constraint that Gameful does not have:

- Table `public.class_adventure_notes` has `UNIQUE (class_id, notebook_id)`.
- That constraint means only **one** adventure row can ever exist per (class, notebook), regardless of `section_id` or `unassigned_at`.
- Consequences you observed:
  1. **Duplicate key error** ("class_adventure_notes_class_id_notebook_id_key") when assigning a second question from the same lesson note, or re-assigning after an unassign that left a soft-deleted row behind.
  2. **Tick disappears on reopen** — the assign succeeded on the first click via the `reusable` code path, but when a second question tried to insert, the insert failed silently for that class row, so on reopen `assignmentByClass` / `adventureByClass` didn't find an active row and the checkbox came up empty.

In Gameful, the same code works because rows are scoped by `(class_id, notebook_id, section_id)` and there is no unique constraint blocking additional sections or soft-deleted rows.

## Changes

1. **Database migration** — drop the bad constraint (additive, no data loss):
   ```sql
   ALTER TABLE public.class_adventure_notes
     DROP CONSTRAINT IF EXISTS class_adventure_notes_class_id_notebook_id_key;
   ```
   After this, each question (section) can be assigned as its own adventure, ticks persist across reopens, and the "duplicate key" toast is gone. No table/column changes.

2. **Lesson Notes page — add Back button** (`src/pages/LessonNotesPage.tsx`)
   Add an `ArrowLeft` icon button at the far left of the header that calls `navigate(-1)` (falls back to `/teaching-hub` if there's no history). Purely visual/navigation — no behavior change to any other flow.

## Out of scope

- No changes to `AssignDialog.tsx` or `classAdventures.ts` — they already mirror Gameful; the constraint was the blocker.
- No schema changes beyond dropping the one constraint.