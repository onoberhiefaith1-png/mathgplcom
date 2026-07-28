
# Group Competition on the Existing Progress Bar

The current system already has groups (`adventure_groups`), per-group bar scoping, one Class Gallery, and group-tagged awards (`class_gallery_awards.group_id`). What is missing is the parts below. Nothing about the Adventure Editor, Smartboard, Gallery architecture or reward pipeline is redesigned.

## What is wrong today (verified in code)

- **Add Group requires an unused bar.** `GroupsPanel` only lets a teacher pick a Progress Bar the Adventure author already drew (`availableBars`). No adoption, no duplication.
- **Every bar has its own assessment.** `ensureClassGameBoards` creates a *separate* `assessments` row per bar element. If two groups sat on two authored bars they would be answering two different assessments, so moving a student between groups would leave their score behind.
- **Students not in a group form a hidden "Whole Class" bucket** (`wholeClassSet` in the dashboard, `groupId = myGroups[0] ?? null` in the student Gallery). Once grouping starts nobody should be left in that bucket.

## 1. Group A adoption (first Add Group)

`GroupsPanel` gets a single primary action: **Add Group**.

- First click: take the lesson's existing Progress Bar (the bar already linked to the assignment), create group "Group A" pointing at that same `progress_element_id`, and insert an `adventure_group_members` row for **every** current class member. The bar keeps its element, settings, and Adventure Editor position untouched.
- Rename stays as it is today.

## 2. Additional groups = exact clones

Later clicks clone the Group A bar. Because the Adventure (`games` row) is a reusable template shared by every class, the clone is **not** written into the game canvas — it is a class-scoped overlay stored on the group row, rendered by cloning the source `CanvasElement` and overriding only `id`, `x`, `y`.

New additive columns on `adventure_groups`: `source_element_id text`, `is_primary boolean default false`, `position_x double precision`, `position_y double precision`.

Everything else — goal %, `progress.totalMarks`, segments, preset, slot effects, fill style, colours, animation, scale, rotation, opacity, tint, slant — is inherited verbatim from the source element at render time, so a later edit to the original bar in the Adventure Editor keeps every group identical.

## 3. Shared questions, shared assessment (the key fix)

`ensureClassGameBoards` is extended so a cloned bar's `class_game_boards` row reuses the **source bar's `assessment_id`** instead of compiling a second assessment. Consequences:

- All groups answer the same Lesson Note questions from the same Adventure — required by the spec.
- A student's marks live once in `assessment_progress`. Moving them between groups instantly re-attributes their score, progress, assessment/assignment state, Smartboard work and live activity, because `barScope` aggregation in `useAdventureSync` is computed from group membership, not from stored per-bar totals. No data migration on move.
- The clone still counts only its own members via the existing `barScope` map.

## 4. Non-overlapping auto-placement

A placement helper computes the clone's `x/y` on the normalised stage: it takes the source bar's footprint (scale × natural aspect), walks candidate slots on a grid with a fixed gap, and rejects any candidate whose rect intersects an existing bar, the Time Bar, or a reward element. If no slot fits, **Add Group is hidden/disabled** with a short "No space for another bar" note. No overlapping bar is ever created.

## 5. Dragging

On the teacher Adventure Dashboard only, cloned bars get a drag handle that writes `position_x/position_y` back to `adventure_groups` (clamped to stage, collision-checked on drop). The original Group A bar is not draggable. Dragging touches position only. Students see the saved positions read-only (they already re-render from the same group rows via `useAdventureGroups` realtime).

## 6. Student list and Move To

`GroupCard` swaps today's "remove student" X and "add from Whole Class" select for a **Move To** dropdown on every student listing all groups. Selecting one calls the existing `assignStudentToGroup`, which already enforces one group per student. The "Whole Class" card disappears once grouping starts (every student belongs to a group); it remains the only view when no groups exist.

## 7. Winning and Gallery

Unchanged pipeline: first bar to reach its target fires `useRewardTransfer`, which reads `barOwner` and writes `class_gallery_awards` with that `group_id`. One Class Gallery per class stays. Teacher Gallery is switched to show **all** awards (master view); student Gallery keeps its existing group filter, which now resolves correctly since every student has a group.

## Technical notes

- Migration (additive only): four columns on `adventure_groups`; no existing table or column altered.
- Files touched: `src/lib/adventures/groups.ts`, `src/hooks/useAdventureGroups.ts`, `src/components/adventures/GroupsPanel.tsx`, `src/lib/games/gameQuestions.ts`, `src/pages/class/AdventureDashboardPage.tsx`, `src/pages/student/GamePlayPage.tsx`, plus a new `src/lib/adventures/groupBars.ts` (clone + placement math) and a small unit test for the collision/placement helper.
- No changes to the Adventure Editor, Smartboard, assignment pipeline, or Gallery editor.
