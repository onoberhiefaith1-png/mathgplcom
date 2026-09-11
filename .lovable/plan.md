# Fix the two broken Smartboard entry routes

## What I verified

There is only one Smartboard. "Lesson Note → Present" and "Smartboard → pick a note" navigate to the *same* address (`/smartboard/<note id>`) and render the same board with the same Floating Number code. So the board code is not the difference.

The difference is **which copy of the lesson note is opened**.

Checked in the live data:

- Your prepared "linear equation" note (the one you work in) has Floating Number rows saved on Example 1 (3 rows) and Example 3 (8 rows).
- The copy of that same note stored inside class **t1** has **zero** Floating Number rows on every question. Same for the "Quadratic Equation" note: the working note has 14 prepared rows on Example 1, its class copy has none.
- Assigning a note to a class makes a separate stored copy. Prepared Floating Numbers are saved on each question row, not inside the page text, so a copy taken before (or independently of) your preparation carries the questions but not the prepared numbers.
- The Smartboard picker lists *every* note, including those stored copies, so choosing a note there can open the copy instead of the prepared original.
- The copy also loses the durable per-question key, so when it is opened the questions are re-keyed by matching text. When that match is imperfect, saved numbers can attach to the wrong question — which is what "merged" and "wrong order" look like.

That fully explains: works from the lesson note and from Test on Smartboard, wrong or empty from the Smartboard picker and from the class board.

## What I will change

1. **Smartboard picker shows only your real lesson notes.** Stored class copies and internal copies are hidden from the picker, so opening a note there always opens the prepared original.

2. **Class board presents the prepared lesson.** When a class copy is opened, its questions are matched to the original note and the prepared Floating Number rows are brought across before the board renders, so the class board shows exactly what the test board shows. If a question genuinely has no prepared numbers, it opens with none — nothing is ever invented from the written solution.

3. **Copying a note keeps question identity.** Duplication will carry the durable per-question key and all prepared floating fields, so a copy can never re-key its questions and can never attach one question's numbers to another.

4. **Keeping a class note up to date.** Re-assigning or saving back to a class refreshes the stored copy from the prepared original, so later preparation reaches the class instead of being stranded.

## What I will not change

- No new Smartboard, no second Floating Number system, no new data model.
- Test on Smartboard and Lesson Note → Present are untouched.
- No regeneration of Floating Numbers from solution text.

## Technical notes

- `src/components/smartboard/SmartboardShelf.tsx`: filter the notebook query by `storage_scope = 'workspace'` and exclude internal/test workspaces.
- `src/lib/lessonnotes/notebookCopy.ts`: include `doc_key` in the section/subsection insert alongside `stable_key` and the existing floating columns.
- New helper (e.g. `src/lib/lessonnotes/hydrateFloatingFromOrigin.ts`): for a notebook with `origin_notebook_id`, match subsections by `doc_key`, then `stable_key`, then normalised problem text, and copy `floating_lines` / `floating_bucket` / `floating_highlights` / `floating_scoring` only where the target is empty. Called once on class-gateway open (`SmartBoardPage`) before `PresentationView` mounts, and awaited so the first render already has canonical data.
- Backfill the two existing class copies (`f66ee1e6…`, `8ab26760…`) with the same matching logic via a one-off migration or script.
- Tests: unit test for the origin-hydration matcher (doc_key hit, stable_key hit, text fallback, never overwrite non-empty target) plus a parity test asserting `buildLessonBoardSource` output is identical for the original and its hydrated copy.
- Verify by signing in and opening the same question through Test on Smartboard, Lesson Note → Present, Smartboard picker, and Class → SmartBoard, comparing line and chip order.
