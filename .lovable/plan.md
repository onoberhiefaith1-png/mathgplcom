## What is actually broken (verified in your data)

I inspected the live rows for your class. The findings:

- Your lesson note currently has **3 sections**, all created at `22:03` today — every earlier section id is gone.
- `class_adventure_notes` holds **5 active rows** for that one note. Only 2 point at sections that still exist; **3 are orphans** pointing at deleted sections.
- The adventure assessment linked to bar `ADDIV` contains **1 question, 14 marks** — compiled at a moment when most references were orphaned.

Cause: `src/lib/lessonnotes/syncDocumentToNotebook.ts` **deletes every section/subsection row and re-inserts them with brand-new UUIDs on every document save** (line 247). Assignments store `section_id`. So every time you edit or even re-open/save the note:

1. The stored `section_id` stops matching anything → the Assign dialog can't find your assignment → **the tick disappears**.
2. The orphan row is still "active", so the dashboard still counts it → **"3 questions / 0 marks"** (0 because the compiler finds no subsections).
3. You tick again → a **new** row is inserted for the new section id → **5 questions** where you have 2.

Nothing in the assign code can fix this — the identity it depends on is destroyed underneath it. So the pipeline gets rebuilt on a stable identity.

---

## Rule 0 — Permanent tick

A tick, once applied, survives note edits, re-saves, re-generation, reloads and time. The only way it turns off is the teacher clicking it, confirming "Remove from this class?", and applying. Un-assigning removes the card from the Adventures/Assignments dashboard. Re-assigning reuses the same row — never a second one.

---

## Part 1 — Stable question identity (the foundation)

**Migration (additive only):**
- `notebook_sections.stable_key uuid` and `notebook_subsections.stable_key uuid`, defaulted to `gen_random_uuid()`, unique per notebook.
- `class_adventure_notes.question_key uuid`, `assessments.question_key uuid`, `class_game_boards.question_keys uuid[]`.
- Backfill `stable_key` for all existing rows and copy the matching key into existing assignment rows.
- Partial unique index: one **active** (`unassigned_at is null`) `class_adventure_notes` row per `(class_id, notebook_id, question_key)`, and the same for active `assessments`. Duplicates become impossible at the database level, not just in code.

**Rewrite `syncDocumentToNotebook.ts` — no more delete-and-recreate.** It becomes a reconcile:
- Each question node in the document carries its `stable_key` as a node attribute (written back on first sync).
- Sync matches document nodes to existing rows by `stable_key`, then falls back to problem text, then to position.
- Matched rows are **updated in place** (ids preserved). Only genuinely new questions insert; only genuinely deleted questions delete.
- Floating lines/highlights/buckets stay on their own row instead of being re-paired heuristically.

This alone makes the tick permanent, because the thing the tick points at stops changing.

**One-off repair:** delete the 3 orphaned `class_adventure_notes` rows for your class, and re-key the 2 valid ones to the surviving questions, so today's dashboard shows 2 questions with real marks.

---

## Part 2 — Delete and replace the assign pipeline

Removed: the current lookup/insert logic in `AssignDialog.tsx`, `assignAdventureNote` in `classAdventures.ts`, and the delete-then-recreate block in `LinkAdventureDialog.tsx`.

New `src/lib/assignments/pipeline.ts` — single source of truth for the whole flow:
- `loadAssignmentState(notebookId, questionKey)` → which classes are ticked, for both Assignment and Adventure targets, keyed by `question_key`.
- `assign(...)` → idempotent upsert on `(class_id, notebook_id, question_key)`; if a soft-unassigned row exists it is revived, never duplicated.
- `unassign(...)` → sets `unassigned_at`, which drops the card off the dashboard immediately.
- `syncAdventureBoard(...)` → recompiles the linked assessment **in place** (same assessment id) from the currently active question keys, instead of delete + insert. Marks and question counts follow the note automatically.

The Assign dialog keeps its look; it just reads and writes through this module and shows the "Remove from this class?" confirmation on untick.

---

## Part 3 — Linking to a progress bar

- A bar link stores the list of `question_keys` it covers.
- Re-opening "Link to Adventure" shows the existing selection already ticked.
- Re-linking updates the existing `class_game_boards` + `assessments` rows; it never creates a parallel copy.
- Question count and marks on the Adventures card come from the active question keys, so "5 questions / 0 marks" cannot recur.

---

## Part 4 — Student side: all questions, each on its own board

- The right-hand panel opened by clicking a progress bar lists **every** question attached to that bar (currently it shows one because the assessment was compiled with one).
- Each question row shows its number, marks and completion state, and is clickable.
- Clicking opens `/student/class/:classId/assessment/:assessmentId?q=<questionId>` — a **separate board session per question**.
- **Board state migration (additive):** new table `assessment_question_board_state` keyed on `(assessment_id, student_id, question_id)` with the same grants/RLS shape as today's table. `useAssessmentBoardSession` and the teacher's live-mirror read/write this. The old table stays untouched.
- Realtime channel names include the question id, so the teacher's live mirror follows the exact question the student is on and **the previous question's working never bleeds into the next one**.

---

## Verification before I report done

1. Assign 2 questions → edit and re-save the lesson note several times → reopen Assign: both still ticked, dashboard still shows 2 questions with correct marks.
2. Untick one, confirm removal → card leaves the dashboard → re-tick → still 2 questions, no duplicate rows (checked directly in the database).
3. Link to a bar twice in a row → exactly one `class_game_boards` row and one assessment.
4. As a student in a real browser session: click the bar → panel lists both questions → open Q1, write, go back, open Q2 → Q2's board is empty; return to Q1 → its work is intact.

## Technical notes

Additive migrations only; no existing table or column is modified or dropped. The Smartboard, Game Editor and all current layouts stay as they are — the changes are in identity, assignment persistence, and the student question panel/routing.
