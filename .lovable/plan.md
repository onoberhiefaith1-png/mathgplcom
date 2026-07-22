# Copy gameful's gameplay stack (verbatim, adapt only integration)

Source project: **gameful** (`c57919df-60ec-47ba-ae42-40f3a118f9d1`). Rule: copy files as-is where they don't exist locally or are older; keep newer local files (Game Editor, editor UI, current Smartboard shell) untouched.

## Scope — what gets copied

### 1. Lesson Notes → Assignment → Adventure workflow
- `src/lib/adventures/classAdventures.ts` — align helper signatures with gameful (assign/unassign/list).
- `src/lib/assessments/{assessmentBoardSource,createAssessment,lessonProgress}.ts` — port any missing exports.
- `src/pages/class/ClassLessonNotesPage.tsx` — verify Assign-as-Assignment/Adventure dialog matches gameful.
- `src/pages/class/ClassAssignmentsPage.tsx`, `ClassAdventuresPage.tsx` — replace with gameful versions.
- `src/pages/class/AssignmentDashboardPage.tsx` — replace with gameful version.

### 2. Adventure Dashboard (assessment status + linked bars + %)
- `src/pages/class/AdventureDashboardPage.tsx` — replace with gameful.
- `src/components/dashboards/AssessmentStatusPanel.tsx` — replace with gameful (In Progress / Completed / Inactive + group bars).
- `src/components/adventures/LinkAdventureDialog.tsx` — replace current `components/games/LinkAdventureDialog.tsx` with gameful's version (Time Bar / Progress Bar picker as in screenshot).
- `src/components/adventures/TimeBarControl.tsx` — new file, replaces custom `TimeBarControls.tsx` usage in dashboard.

### 3. Real-time sync (Smartboard presence → status)
- `src/hooks/useAdventureSync.ts`, `useAdventureHeartbeat.ts` — replace with gameful versions.
- `src/hooks/useClassMemberIds.ts` — new file (drives student roster in dashboards).
- `src/lib/realtime/lessonPresence.ts` — align channel names + payload with gameful so enter/exit Smartboard flips In Progress/Inactive live.
- `src/hooks/useSmartboardSync.ts` — keep local (newer), but ensure it emits the same presence beacons gameful expects.

### 4. Progress Bar system
- `src/components/gamebuilder/ProgressColumn.tsx` — already ported earlier; re-verify parity.
- `src/lib/games/{gameQuestions,classGames,games,types,progressPresets,urls,assets}.ts` — port missing helpers (`prefetch.ts` is new).
- Percentage-goal input in `SettingsPanel.tsx` — keep local (already added) but reconcile field name with gameful's `progressGoalPct`.

### 5. Time Bar
- `src/hooks/useGameTimeBar.ts` — port from gameful, replacing local `useTimeBar.ts` behaviour (teacher start / scheduled start / duration / slot fill / lock on expiry).
- Wire `components/adventures/TimeBarControl.tsx` into `ClassGameLivePage` and read-only into `StudentGameLivePage`.

### 6. Student gameplay
- `src/pages/student/{StudentClassPage,StudentAssignmentPage,AssessmentBoardPage,GamePlayPage,StudentSmartBoardPage}.tsx` — port gameful versions where missing behaviour (score accumulation → live progress).
- Keep local `StudentGamesPage.tsx`, `StudentAdventuresPage.tsx`, `StudentGameLivePage.tsx` (newer UI); only inject gameful's hooks/handlers.

### 7. Teacher monitoring
- `src/pages/class/ClassSmartBoardLauncher.tsx`, `TeacherAssessmentViewerPage.tsx`, `StudentsPage.tsx` — port gameful behaviour.
- Keep local `ClassGameLivePage.tsx`, `ClassGamesPage.tsx` UI; only swap the sync hook + status panel.

### 8. Smartboard (recent improvements only)
Copy only these gameful smartboard files that carry the newer line workflow / equivalence checking:
- `src/components/smartboard/{LineStatusRail,SmartLineLayer,VerificationPanel,PhaseStage,WritingSensor,WritingSurface,Inked,MathTreeRender}.tsx`
- `src/lib/mathboard/equivalence.ts`, `src/lib/smartboard/*` — port missing files.
- Do NOT overwrite: `TopBar.tsx`, `SettingsSheet.tsx`, `BottomPanel.tsx`, `RightTools.tsx`, or anything the current Smartboard shell relies on that is newer here.

## What stays untouched (newer locally)
- Game Editor (`pages/QuestionProgressContainerEditor.tsx`, `pages/adventure/*`, `pages/SmartboardPreviewPage.tsx`).
- Notebook editor + AI stack (`pages/NotebookEditorPage.tsx`, `supabase/functions/notebook-ai/*`).
- Geometry / floating / properties-panel systems.
- Universal editing right-hand panel rule.

## DB
No schema changes. Phase-0/3 migrations already added `game_sessions`, `game_progress`, `game_time_bars`, `adventure_live_sessions`, `class_adventure_notes`, extra columns. Gameful uses the same table names — reuse as-is.

## Execution order
1. Libs (`lib/games`, `lib/adventures`, `lib/assessments`, `lib/realtime`).
2. Hooks (`useAdventureSync`, `useAdventureHeartbeat`, `useClassMemberIds`, `useGameTimeBar`).
3. Shared components (`AssessmentStatusPanel`, `adventures/LinkAdventureDialog`, `adventures/TimeBarControl`).
4. Class pages, then student pages.
5. Smartboard delta (line rail + verification + equivalence only).
6. Typecheck; smoke-test teacher-assign → student-play → live dashboard.

## Non-goals
- No visual redesign.
- No new tables/columns.
- No changes to Game Editor, notebook editor, or geometry.
