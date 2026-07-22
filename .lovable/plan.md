
# Migrate gameplay features from `gameful` → this project

Purely additive. Nothing existing is replaced. Where a filename exists in both projects, I keep this project's version and only add integration seams inside it (1–2 lines) with your approval mid-flight.

## Guardrails (apply to every phase)

- **Do-not-touch UI files (this project wins):** `SmartBoardPage.tsx`, `PresentationView.tsx` and everything under `src/components/smartboard/**`, `MathBoardPage.tsx`, `LessonNotesPage.tsx`, `NotebookEditorPage.tsx`, `src/pages/adventure/AdventureGameEditor.tsx`, `src/pages/adventure/AdventureGamesDashboard.tsx`, `QuestionProgressContainerEditor.tsx`, and all current `src/components/adventure/**`. If a gameful feature needs to reach into one, I add a small hook/prop seam and pause to show you the diff.
- **Additive schema only.** Every migration uses `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` / `CREATE POLICY IF NOT EXISTS`. No `DROP` on existing objects. No changes to existing columns' types or defaults. If a gameful migration would conflict (e.g. tightening an existing policy), I stop and ask.
- **Reuse before create.** If a table/column/function already exists (even under a different name), I reuse it and note the mapping in the phase notes rather than duplicating.
- **Not migrated (per your list):** old Smartboard, old Game Editor, 3D geometry, Reports, anything unfinished on the branch.

## Phase 0 — Schema foundations (approval gate: one migration)

Additive DDL only. Adds what every later phase depends on.

- Helper functions (create if absent): `is_class_owner(uuid)`, `is_class_member(uuid)`, `shares_class_with(uuid)`, `notebook_shared_to_member(uuid)`, `can_access_realtime_topic(text)`, `ensure_class_game_boards(uuid, uuid)`, plus the `assessment_progress_guard` / `_insert_guard` / `game_progress_guard` triggers.
- Columns (`ADD COLUMN IF NOT EXISTS` only):
  - `assessments`: `assigned_at`, `due_at`, `unassigned_at`
  - `assessment_progress`: `per_question jsonb default '{}'`
  - `class_game_boards`: `notebook_id`, `required_marks`, `section_id`
  - `notebooks`: `score_label text default 'Marks'`
- New tables (all with GRANTs → RLS → policies in the required order):
  - `class_adventure_notes`
  - `game_sessions`, `game_progress` (only if absent — they're referenced by gameful policies)
  - `game_time_bars`
  - `adventure_live_sessions`
- Realtime publication: add the new/needed tables (`class_game_boards`, `class_adventure_notes`, `assessment_progress`, `assessments`, `class_games`, `class_members`, `game_time_bars`, `adventure_live_sessions`) using the `DO $$ … EXCEPTION WHEN duplicate_object` pattern so re-runs are safe. Set `REPLICA IDENTITY FULL` where gameful does.
- No policy replacements on existing tables. If a stricter policy is required (e.g. the split student SELECT/INSERT/UPDATE on `assessment_progress`), I list it and ask before running.

After you approve and it runs, the regenerated `types.ts` unblocks all later phases.

## Phase 1 — Lesson Note → Assignment → Smartboard workflow

- Copy `src/lib/assessments/{createAssessment.ts, lessonProgress.ts}` and refresh `assessmentBoardSource.ts` from gameful (already present here; diff and merge additively).
- Copy `src/pages/class/AssignmentDashboardPage.tsx`, `TeacherAssessmentViewerPage.tsx`, `src/pages/student/StudentAssignmentPage.tsx`.
- Update `src/pages/student/AssessmentBoardPage.tsx` only where needed to write `assigned_at` / `due_at` / `per_question` fields; existing student flow preserved.
- Add routes in `src/App.tsx` for the new pages.
- Seams into protected UI: none required — this phase adds sibling pages.

## Phase 2 — Adventure → Game → Smartboard workflow

- Copy `src/lib/adventures/classAdventures.ts`, `src/lib/games/{classGames.ts, gameQuestions.ts, prefetch.ts}` (merge into existing files where already present — additive only).
- Copy `src/components/adventures/LinkAdventureDialog.tsx`.
- Copy `src/pages/class/{ClassAdventuresPage.tsx, AdventureDashboardPage.tsx, ClassGamesPage.tsx}` and `src/pages/student/GamePlayPage.tsx`.
- Route wiring in `src/App.tsx`.
- Reuse existing `adventure_games` / `adventure_scenes` tables — no schema changes here (Phase 0 already added the linking columns).
- Seam: launcher buttons on the existing Class dashboard use existing patterns; no edits to Smartboard/Editor UI.

## Phase 3 — Progress Bar system (dynamic slots, dynamic reconstruction)

- Copy `src/lib/games/progressPresets.ts` additions and any new preset assets from gameful `src/assets/progress/`.
- Copy `src/components/gamebuilder/ProgressColumn.tsx` as a new **sibling** component (do not modify the existing Game Editor). Expose it via a hook so any consumer that wants the dynamic-slot behaviour opts in.
- Add the required-marks / teacher-configurable slot logic behind a new `useProgressBar` hook reading `class_game_boards.required_marks` + `progress_element_id`.
- Old fixed-10-slot code stays untouched but is bypassed by the new hook when the row has `required_marks`.

## Phase 4 — Realtime synchronization

- Copy `src/lib/realtime/**` additions (assessment presence, class-assessments, adventure-live-session channels).
- Add subscribers in the new dashboard/student pages from Phases 1–2 only. Existing hooks (`useSmartboardSync`, etc.) are not modified.
- All channels are private + go through `ensureRealtimeAuth` (already present here).

## Phase 5 — Assessment Status workflow (In progress / Inactive / Completed)

- Adopt gameful's rule: `in_progress` when the student's Smartboard is open (heartbeat into `adventure_live_sessions` or a new `assessment_presence` channel), `inactive` otherwise, `completed` when `score ≥ required_marks`.
- Implemented as a small hook mounted by `AssessmentBoardPage.tsx` (writes `last_seen_at`) plus a derived column read in the teacher dashboard. No smartboard UI edits.

## Phase 6 — Percentage-based scoring

- Copy `src/lib/assessments/lessonProgress.ts` grand-total / required-score helpers.
- Add a teacher percentage input on `AssignmentDashboardPage`. Persist to `class_game_boards.required_marks = ceil(total_marks * pct/100)`.
- Live recalculation via the Phase 4 subscription.

## Phase 7 — Adventure Dashboard improvements

- Populate `AdventureDashboardPage` (added in Phase 2) with grouped lesson questions, question counts, total marks, progress-bar link picker, dynamic calculations, teacher controls. All in the new page — no edits to existing Adventure pages.

## Phase 8 — Time Bar foundation

- Copy `src/components/adventures/TimeBarControl.tsx` and wire it to `game_time_bars` (Phase 0). Exposed only inside the new Adventure Dashboard — no changes to Game Editor UI.

## Files that will be added (net new, non-conflicting)

```text
src/lib/adventures/classAdventures.ts
src/lib/assessments/lessonProgress.ts
src/lib/games/prefetch.ts                 (if not present)
src/lib/games/gameQuestions.ts            (merge additively if present)
src/components/adventures/LinkAdventureDialog.tsx
src/components/adventures/TimeBarControl.tsx
src/components/dashboards/AssessmentStatusPanel.tsx
src/components/gamebuilder/ProgressColumn.tsx   (sibling, not a replacement)
src/pages/class/AssignmentDashboardPage.tsx
src/pages/class/AdventureDashboardPage.tsx
src/pages/class/ClassAdventuresPage.tsx
src/pages/class/ClassGamesPage.tsx
src/pages/class/TeacherAssessmentViewerPage.tsx
src/pages/student/StudentAssignmentPage.tsx
src/pages/student/GamePlayPage.tsx
```

## Files I will only touch with your per-file approval

`src/App.tsx` (route additions), `src/pages/student/AssessmentBoardPage.tsx` (write new columns), `src/pages/ClassDashboardPage.tsx` and existing class/student pages that need launcher buttons.

## Explicitly out of scope

Old Smartboard, old Game Editor, 3D geometry, Reports, any not-yet-built work. Existing UI in this project always wins on conflict.

## Execution rhythm

Phase 0 first (single migration, you approve). After each subsequent phase, I stop, show a diff summary, and wait before moving on. If any phase turns up a real conflict with your current architecture, I pause and ask instead of overwriting.
