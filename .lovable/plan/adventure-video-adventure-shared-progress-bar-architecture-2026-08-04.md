# Adventure & Video Adventure — Shared Progress Bar Architecture

One editing workflow, two gameplay identities: Adventure is a race, Video Adventure is a cinematic journey with checkpoint qualification.

## 1. Fixed two-bar architecture (new games)

Every Scene (Adventure) and every Learning Point (Video Adventure) is created with exactly two bars:

- **Time Progress Bar** — system owned. Cannot be renamed, deleted, replaced, or linked to questions. The teacher may only change its appearance (crystal / lava / fire / water / sand / energy presets) and its **Time Duration**: No Time, 1, 2, 5, 10, 15, 20, 30 minutes.
- **Learning Progress Bar** — default name "Progress Bar", renamable (Temple Crystal, Guardian Seal, …). This is the only bar linked to questions, lesson notes, scores, student progress and rewards.

"Add Progress Bar" is removed from the editor. Existing adventures keep working exactly as they are today; the two-bar rule applies to newly created adventures only.

**No Time** behaviour: in Adventure the Time Bar is hidden at runtime and there is no countdown (a pure race). In Video Adventure, publishing/linking is blocked with the instructional notice: "A Video Adventure requires a Time Progress Bar for each Learning Point. Please set a duration before publishing your adventure."

Adventure also loses **Add Scene** — a static Adventure is one complete challenge.

## 2. Group Mode on the Adventure Dashboard

The dashboard (Total Students, Questions, Marks, Progress Summary, Time Bar, Assessment Dashboard, Group Bars) keeps its current layout. Only grouping changes:

- Class Mode by default — one Learning Progress Bar for the whole class.
- First **+ Add Group** asks for a name (default "Group A") and adopts the existing bar. Nothing is duplicated.
- Each later **+ Add Group** asks for a name and duplicates the Learning Bar into free space. Maximum 10 groups (A–J).
- The original (Group A) bar stays locked. Duplicates become editable: move, resize, colour, visual style, animation, effects. Questions, scoring and reward assignment are never editable — every duplicate points at the same lesson content.
- **+ Add Students** lists every student in the linked class; moving a student removes them from their previous group. One group per student. Moving mid-game preserves score, question progress and completion state.
- New setting under Add Group: **Group Completion Message**, prefilled with the encouraging default text and freely editable by the teacher.

**Scoring per group**: Grand Score = Total Marks × students in that group; Target, Percentage and Completion Threshold recalculate per group and update live as students move. The Assessment Dashboard tracks In Progress / Completed / Inactive independently per group.

## 3. Adventure gameplay — race

- No groups: first student to 100% wins immediately; the reward flies to that student and the adventure ends.
- With groups: first group to complete its Learning Bar wins; the reward goes to that group and the game ends at once. No timer, no waiting.

## 4. Video Adventure gameplay — checkpoint qualification

- Groups travel the story together. Reaching 100% early does not advance a group; the Learning Point stays open until its Time Bar expires.
- When the Time Bar hits 100%, every group is evaluated independently: Learning Progress ≥ required target → qualified, continues to the next Learning Point; below target → journey ends.
- Ended groups see the teacher-editable Group Completion Message (never "Failed" / "Game Over"), keep their earned rewards and become spectators: the video and story keep playing for them, but their board is locked. No auto-retry and no manual teacher override.
- Only qualified groups interact with the next checkpoint's new Learning Bar, timer and reward. Groups eliminated earlier never reach the final checkpoint and receive no final reward.

**Shared Gallery**: one Gallery per class. Each reward records which groups earned it, and a group's Gallery view is filtered to the rewards that group actually collected. The final reward animates into the Gallery for every qualified group.

## Technical notes

- `src/lib/games/types.ts`: add a bar `role` (`time` | `learning`) to `ProgressConfig`, and `timeDurationSeconds` / `noTime` on the Scene checkpoint fields (Scenes already carry `timerEnabled`/`timeLimit`). `makeScene` / `makeCheckpoint` seed both bars for new games; `normalizeCanvas` infers roles for legacy rows without rewriting them.
- Editor (`AdventureGameEditor.tsx`, `SettingsPanel.tsx`, `ProgressColumn.tsx`, `CheckpointTimeline.tsx`, `SceneStrip.tsx`): drop Add Progress Bar and Add Scene, gate the Time Bar's settings to appearance + duration, and add the publish/link guard for Video Adventure with No Time.
- Additive migration on `adventure_groups`: `style_overrides jsonb`, `qualified boolean default true`, `eliminated_at_scene_id text`; plus a `completion_message text` setting on `class_games` (or a small `class_game_group_settings` row) and `group_ids text[]` on `class_gallery_awards` for per-group reward ownership. New/changed tables get GRANTs; existing RLS patterns (`is_class_owner` / `is_class_member`) are reused.
- Group logic (`src/lib/adventures/groups.ts`, `groupBars.ts`, `groupCompetition.ts`): name prompt on create, 10-group cap, per-group style overrides applied when clone bars are rebuilt, and locked-original enforcement.
- Runtime: `useAdventureSync` gains race resolution for Adventure (first bar to reach required ends the game) and checkpoint evaluation for Video Adventure inside `loopRuntime.ts` — on timer expiry, mark groups qualified/eliminated, show the completion message, and lock the eliminated groups' boards while the video continues.
- `GamePlayPage.tsx` / gallery pages: filter rewards by the student's group and animate only the newest reward.
