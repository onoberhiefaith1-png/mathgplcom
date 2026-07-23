# Port full Adventure + Assignment pipeline from gameful

Goal: match gameful end-to-end — teacher opens a class → picks Adventure or Assignment → sees live rising progress bars and per-student buckets (Inactive / In Progress / Completed) → students play the linked game/assessment → scores stream back in real time.

The file layout in this project already mirrors gameful, but several files are stale or diverged. I'll re-copy the pipeline verbatim so behavior matches exactly.

## Files to copy verbatim from gameful → this project

Pages (teacher):
- `src/pages/class/ClassAdventuresPage.tsx`
- `src/pages/class/ClassAssignmentsPage.tsx`
- `src/pages/class/AdventureDashboardPage.tsx`  ← live monitoring, rising bars, buckets
- `src/pages/class/AssignmentDashboardPage.tsx` ← same buckets for assignments
- `src/pages/class/TeacherAssessmentViewerPage.tsx`

Pages (student):
- `src/pages/student/StudentAssignmentPage.tsx`
- `src/pages/student/AssessmentBoardPage.tsx`
- `src/pages/student/GamePlayPage.tsx`
- `src/pages/student/StudentClassPage.tsx` (already ported — re-sync if diverged)

Components:
- `src/components/dashboards/AssessmentStatusPanel.tsx` (the Inactive / In Progress / Completed buckets)
- `src/components/adventures/LinkAdventureDialog.tsx`
- `src/components/adventures/TimeBarControl.tsx`

Hooks:
- `src/hooks/useAdventureSync.ts` (drives rising bars + presence + heartbeat)
- `src/hooks/useAdventureHeartbeat.ts`
- `src/hooks/useClassMemberIds.ts`
- `src/hooks/useGameTimeBar.ts`

Lib:
- `src/lib/adventures/classAdventures.ts`
- `src/lib/assessments/{assessmentBoardSource,createAssessment,lessonProgress}.ts`
- `src/lib/realtime/{auth,classPresence,lessonPresence}.ts`
- `src/lib/games/{classGames,gameQuestions,games,prefetch,progressPresets,types,urls,assets}.ts`

## Wiring
- Confirm `src/App.tsx` routes match gameful for:
  - `/teaching-hub/classes/:classId/adventures` and `.../assignments`
  - `/teaching-hub/classes/:classId/adventures/:gameId` (dashboard)
  - `/teaching-hub/classes/:classId/assignments/:notebookId` (dashboard)
  - `/student/class/:classId/games/:gameId/play`
  - `/student/class/:classId/assignment/:notebookId`
  - `/student/class/:classId/assessment/:assessmentId`
- Fix any import drift after copy (tsgo).

## Data / backend
No schema changes planned — this project already has `assessment_progress`, `adventure_live_sessions`, `class_games`, `class_game_boards`, `assessments`, and realtime enabled. If a copied file references a column that isn't in this DB (verified only during build), I'll stop and ask before adding an additive migration.

## Verification
1. tsgo passes.
2. Open a class → Adventures → live dashboard shows bars + three buckets.
3. Student plays → teacher sees student move Inactive → In Progress → Completed and bar rise in realtime.
4. Same flow for Assignments dashboard.

## Out of scope
- No visual redesign; presentation matches gameful exactly.
- No changes to Smartboard, Lesson Notes editor, or Game Editor beyond wiring already used by these pages.
