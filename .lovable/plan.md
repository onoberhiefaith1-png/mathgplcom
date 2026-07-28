## Goal

Make the five workspaces (Lesson Notes, SmartBoard, Classes, Adventures, Class Gallery) independent, and connect them through an explicit **assignment instance** identified by (Lesson Note + Class + Adventure). No UI redesign — data model and wiring only.

## What the current code actually does (verified)

- There is **no assignment-instance record**. An "assignment" today is either a row in `assessments` or a row in `class_adventure_notes`, each keyed only on (class, notebook, question_key). Neither table has a game/adventure column, so the same Lesson Note cannot be assigned to one class with two different Adventures.
- The Adventure link is a separate table, `class_game_boards` (class_id, game_id, progress_element_id, assessment_id, question_keys), created by `ensureClassGameBoards` in `src/lib/games/gameQuestions.ts`. It ties a progress bar to an assessment but is not tied to a lesson-note assignment.
- There is **no archive state**. The only lifecycle flag is `unassigned_at` (a soft un-tick). `assignAdventureQuestion` and `assignAssessmentQuestion` in `src/lib/assignments/pipeline.ts` explicitly *revive and overwrite* the previous row when re-assigning, so reusing a lesson next term destroys the earlier record — the opposite of the required behaviour.
- Class Gallery already matches the spec: `class_galleries` is one row per class and `class_gallery_awards` accumulates awards; nothing there needs restructuring.
- Current data volume is small (10 assessments, 13 adventure notes, 1 game board), so a one-time migration is low-risk.

## Plan

### 1. New table: `learning_assignments` (additive migration)

One row = one learning session instance.

```text
learning_assignments
  id
  class_id        -> classes
  notebook_id     -> notebooks        (Lesson Note)
  game_id         -> games (nullable) (Adventure; null = plain assignment)
  question_keys   uuid[]              (questions pulled from the note)
  mode            'assignment' | 'adventure'
  status          'active' | 'archived'
  due_at, started_at, archived_at, archived_reason
  created_by, created_at, updated_at
```

- Partial unique index on `(class_id, notebook_id, coalesce(game_id, zero-uuid))` **where status = 'active'** — this is the duplicate protection, enforced in the database, and it still allows a new active instance once the old one is archived.
- GRANTs for `authenticated` / `service_role`, RLS: class owner full access; class members read-only.
- Existing `assessments`, `class_adventure_notes` and `class_game_boards` rows gain a nullable `assignment_id` pointing at the parent instance. Nothing is dropped.
- Backfill: create one `learning_assignments` row per existing active (class, notebook) pair and point existing child rows at it, so current dashboards keep working.

### 2. Single write path

Extend `src/lib/assignments/pipeline.ts` with `createAssignment({classId, notebookId, gameId, questionRefs})`:

- Looks for an **active** instance with the same triple. If found, returns a `duplicate` result carrying the existing id — callers show "This Lesson Note is already assigned to this Class using this Adventure" with *Open existing* / *choose another Adventure* / *choose another class*.
- Otherwise inserts a new instance and creates its child rows (assessment + answer key, adventure note, game boards) with `assignment_id` set. Never revives an archived row.
- `unassign` = archive (below), not row reuse. Remove the "revive and overwrite" branches from `assignAdventureQuestion` / `assignAssessmentQuestion`.

### 3. Archiving lifecycle

`archiveAssignment(id, reason)` runs one ordered transaction-style sequence, matching the requested card lifecycle:

1. freeze final progress (`assessment_progress` snapshot stays as-is, no further writes accepted),
2. keep reward history (`class_gallery_awards` untouched — awards are already class-scoped and permanent),
3. set `status='archived'`, `archived_at`, `archived_reason`.

Triggers: teacher un-ticks in the Assign dialog; due date passes (checked on dashboard load); all class members complete the required marks.

Enforcement after archive:
- Student pages filter to `status='active'`; archived cards move to an Archive list on the teacher dashboard and open read-only.
- Server-side: RLS/`WITH CHECK` on `assessment_progress` and `assessment_board_state` rejects writes when the parent instance is archived, so read-only is real and not just a hidden button.

### 4. Adventure reusability

- Adventures (`games`) stay lesson-free: the question/notebook binding moves from the progress-bar element onto the assignment instance's `class_game_boards` rows (already class+game scoped). A progress bar keeps its `progress_element_id` role only.
- `ensureClassGameBoards` becomes `ensureAssignmentBoards(assignmentId)` — same behaviour, scoped to the instance instead of (class, game), so the same Adventure can serve many notes and classes with separate boards and separate progress.

### 5. Read paths

Teacher and student dashboards, progress bars, the reward transfer hook and reports all query `learning_assignments` (filtered by status) and join down to the child rows, instead of guessing relationships from `assessments` + `class_adventure_notes`. Card rendering and layout stay exactly as they are.

## Technical notes

Files: new migration; `src/lib/assignments/pipeline.ts`, `src/lib/adventures/classAdventures.ts`, `src/lib/games/gameQuestions.ts`, `src/lib/games/classGames.ts`, `src/components/lessonnotes/AssignDialog.tsx`, `src/pages/class/AdventureDashboardPage.tsx`, `src/pages/class/AssignmentDashboardPage.tsx`, `src/pages/class/ClassAdventuresPage.tsx`, `src/pages/class/ClassAssignmentsPage.tsx`, `src/pages/student/*`, `src/hooks/useRewardTransfer.ts`.

Marks remain owned by the Floating Number Evaluation page; the assignment instance stores no marks of its own, only references.

## Verification

- Assign Note A → Class D → Adventure G, then repeat: blocked with the duplicate message and an Open-existing action.
- Assign Note A → Class D → Adventure H: allowed, independent progress.
- Archive the first, re-assign the same triple: new instance starts at zero, old one still readable, gallery rewards from the old one still present.
- Student attempts to write to an archived assignment: rejected by the database, not just the UI.
