## What gets built

### 1. Structural reading and editing (the priority)

New abilities alongside the existing ones, each reading its own result back:

| Ability | What it does |
| --- | --- |
| `inspect_lesson_note` | Whole notebook as a tree: sections, sessions, blocks with ids, order and kind, plus what each session is missing (no question / no solution / no highlights / no chips). |
| `edit_lesson_text` | Replace the text of one block, a session title, or the note title. |
| `insert_lesson_lines` | Insert lines at a given position, not only at the end. |
| `move_lesson_lines` | Move existing blocks into another session or section, keeping text byte-identical. |
| `promote_to_session` | Create a proper session (Example/Exercise/Classwork/Homework) and move a question with its solution into it. |
| `reorder_lesson` | Reorder blocks within a session, sessions within a section, or sections within the note. |
| `delete_lesson_lines` | Remove blocks or an empty session. Confirmation-gated, and the preview lists exactly what goes. |
| `snapshot_lesson_note` / `restore_lesson_note` | Take a named restore point before a repair; put the note back afterwards. Restore is confirmation-gated. |

All of them go through the same tables and helpers the editor screens use, so
ordering, line identity (`mintLineUid`) and session layout stay consistent with
what a teacher sees on screen.

### 2. Smartboard and Floating Numbers

- `inspect_board_state` — current session, active line, saved board state, saved
  highlights and chips, and whether the chips still match the current solution.
- `edit_highlights` — adjust which solution lines feed the chips, preserving the
  tokenised maths structure.
- `select_session` / `advance_step` — pick a session and step the board.
- Opening a dry run and verifying a dry run stay separate: she must read the
  board state back before saying a test works.
- Publishing or assigning stays confirmation-gated.

### 3. Safety and honesty

- Destructive abilities preview first, then need `confirmed: true`.
- Every write carries an idempotency key so a retried request cannot double-write.
- Every ability returns the state it read back; when a read-back disagrees with
  the intent, she reports the failure instead of a success sentence.
- Her system prompt gains the repair rules: never append a corrected copy when a
  repair is possible, never rewrite question text, never claim a test passed
  without reading the board.

### 4. Knowledge

The existing approved-knowledge store gains a repair-workflow entry set and keeps
the separation it already has between what was observed and what you approved as
intended. A recorded observation cannot be promoted to intended behaviour without
your approval.

### 5. Acceptance run

On a test notebook whose examples sit inside an Introduction, verified in the
browser end to end: inspect, restore point, promote each question into its own
session, confirm-and-remove the duplicates, read back, regenerate chips, open the
Smartboard test and report only the observed result.

## Out of scope in this pass

Classes, schedules, courses, assignments, games, Adventures, Live sessions,
reports and settings keep the abilities they have today — she can still guide you
through the rest. YouTube and other outside services are not connected, and she
will say so rather than imply access. These come next, once repair is solid.

## Technical notes

- New server abilities land in `src/lib/agent/hands.server.ts` (or a sibling
  `structure.server.ts`), registered in `toolTypes.ts` and `tools.server.ts`;
  authorisation stays with `requireSupabaseAuth` and RLS via the teacher's own
  client, so no new access surface is created.
- Restore points need one additive table (notebook id, owner, label, JSON
  snapshot of sections/subsections/blocks, created_at) with grants and
  owner-scoped RLS. It is staged as a migration and applies when you accept this
  draft, so restore cannot be exercised in the draft preview until then.
- Reordering uses the existing `order_index` columns; moves rewrite parent ids
  and indices in one transaction-style batch, never the `content_ascii` text.
- Chip freshness is derived by comparing saved `floating_highlights` payloads
  against the current solution blocks — no new generator.
