# Group Competition as a Scoreboard, Configured on the Adventure Page

Groups stop being duplicated gameplay objects. The Adventure's original Progress Bar stays the single
master challenge; each group gets a live scoreboard bar derived from its own students' scores. All
group setup moves out of the gameplay dashboard onto the Adventure page.

## 1. Adventure page becomes the setup surface

At the top of the class Adventures page, add a Game Mode selector per adventure (game):

```text
Game Mode:   (•) Individual Mode      ( ) Group Competition Mode
```

- Individual Mode is the default and behaves exactly as today.
- Choosing Group Competition Mode reveals a Group Setup panel on the same page, below the linked
  lesson notes / progress bars, before the teacher ever opens the dashboard.

Group Setup panel:

- Create Group (A, B, C, D … up to 10), rename, delete.
- Assign students from the class roster into groups; a student belongs to exactly one group, and
  moving a student keeps their existing marks.
- Per group it shows: student count, expected score per student, grand total, required marks —
  all recomputed live from the master bar's total marks and the current class roster.
- Group Completion Message (encouraging text) is edited here, not on the dashboard.
- Switching back to Individual Mode keeps the groups on record but the game runs ungrouped;
  a confirm explains that.

## 2. No duplicated bars, no duplicated boards

Today the second group onward duplicates the master bar (a synthetic `grpbar-…` canvas element plus a
copied `class_game_boards` row). That duplication is dropped:

- Every group simply points at the master Learning Progress Bar. No clone element is built, no board
  row is copied.
- A group's progress is a calculation: the group's students' marks on the master bar's assessment,
  against a required mark of `bar total marks × students in that group × goal %`.
- Existing games that already have clone rows keep working: clone rows are read as plain groups and
  their scoreboard is computed the new way; their leftover copied board rows are ignored.

## 3. Gameplay dashboard shows the competition only

Remove from the dashboard: Add Group, rename, delete, student assignment, group styling, completion
message editing — the whole Groups panel.

Group Competition Mode dashboard layout:

```text
Video
--------------------------------------
Current Learning Point · Countdown · Required Mark
--------------------------------------
Group Leaderboard
  Group A  ████████░░  90%   180 / 200
  Group C  ███████░░░  82%   164 / 200
  Group B  █████░░░░░  64%   128 / 200
--------------------------------------
Assessment Dashboard
```

- The leaderboard sorts by percentage, highest first, and updates live as marks arrive.
- Each row shows the group name, a progress bar, achieved / required score, percentage, and a status
  chip: In Progress, Completed, Qualified, or Eliminated for this Learning Point.
- Individual Mode dashboard is unchanged.

## 4. Timer and evaluation

Unchanged in behaviour, now driven by the scoreboard numbers:

- Reaching 100% does not advance a group; the Learning Point stays open until the shared teacher
  countdown reaches zero.
- At zero every group is judged at once from live data: at or above the required mark → Qualified and
  travels to the next Learning Point; below → Eliminated for this Learning Point, switched to View
  Only, and shown the teacher's encouraging message.
- Rows stay visible after judging so the final standings are readable on the smartboard.

## 5. Students

A student in a group still sees only the master bar and their own questions. Their bar's target is
their group's required mark, and View Only is applied when their group is eliminated. No group clone
bars are rendered on the student stage.

## Technical notes

- `class_games` gains `game_mode text default 'individual'` (additive migration, GRANTs on the
  existing table unchanged since no new table is created); `group_completion_message` already exists
  and stays the message store.
- `src/pages/class/ClassAdventuresPage.tsx`: mode radio per game + a new
  `src/components/adventures/GroupSetupPanel.tsx` (create/rename/delete, roster assignment via
  `assignManyToGroup`, live totals, completion message). Reuses `useAdventureGroups` and
  `src/lib/adventures/groups.ts`.
- `src/lib/adventures/groupCompetition.ts`: `addGroup` no longer clones — it creates a group whose
  `progress_element_id` is the master bar id, `source_element_id` null, `is_primary` only for the
  first. Delete `cloneBoardRow` and the `nextGroupBarPosition` call.
- New `src/lib/adventures/groupStandings.ts`: pure function taking the master bar summary,
  `scoresByAssessment`, and `studentsByGroup` → per-group `{ achieved, required, pct, status }`,
  sorted. This replaces `barScope`-keyed-by-element-id for groups (all groups now share one element
  id, so scoping must be per group, not per bar).
- `src/lib/adventures/groupBars.ts`: `withGroupBars` / `buildGroupBarElements` stop emitting clones
  (kept only for legacy reads, or removed from the dashboard and `student/GamePlayPage.tsx` call
  sites). Bar dragging/positioning for clones is removed.
- `src/pages/class/AdventureDashboardPage.tsx`: drop `GroupsPanel`, `withGroupBars`, `moveGroupBar`;
  render a new `src/components/adventures/GroupLeaderboard.tsx` from `groupStandings`. Feed
  `useGroupOutcome` from the standings rather than `statsByBar`.
- `src/pages/student/GamePlayPage.tsx`: target and View Only come from the student's group standing;
  clone-bar filtering removed.
- No student score, gallery, or award data is touched by any of this.
