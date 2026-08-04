---
name: Adventure group progress system
description: Fixed two-bar architecture (Time + Learning), group mode rules, Adventure race vs Video Adventure checkpoint qualification
type: feature
---

## Fixed two Progress Bars

Every Scene (Adventure) and Learning Point (Video Adventure) owns exactly two bars, enforced for newly added bars only (legacy games untouched):

- **Time Progress Bar** (`progress.role === "time"`): system-owned. Name, questions, scoring and deletion are locked; only appearance + `timeDurationSeconds` are editable. `0` = **No Time** (timer hidden entirely).
- **Learning Progress Bar** (`progress.role === "learning"`, default for legacy bars): the only bar linked to questions, scores, rewards. Renameable.

Helpers live in `src/lib/games/types.ts`: `nextBarRole`, `isTimeBar`, `timeBarOf`, `learningBarOf`, `sceneTimeSeconds`, `checkpointsMissingTime`, `TIME_DURATION_OPTIONS`, `VIDEO_TIME_REQUIRED_MESSAGE`.

Video Adventure cannot be linked/published to a class while any Learning Point has No Time — `LinkAdventureDialog` blocks it with the instructional message (not an error).

Adventure is one complete challenge: **no Add Scene** (SceneStrip `onAdd` omitted).

## Group mode

- Class Mode by default. First **Add Group** *adopts* the existing Learning Bar (nothing duplicated) and puts every student in it; later clicks duplicate it. Teacher is prompted for a name each time. Max **10 groups** (`MAX_GROUPS`).
- Primary group's bar is locked. Duplicates are movable/resizable/recolourable (`adventure_groups.style_color/style_scale/style_preset_id`) — never questions, scoring or reward assignment.
- One student per group; moving a student never resets score or progress.
- Score per group = marks × students in that group × goal%.

## Gameplay rules

- **Adventure = race.** First group (or student) to 100% wins immediately; reward goes to them, game ends. `raceWinner` + `class_games.winner_group_id`.
- **Video Adventure = journey.** 100% first does not advance; the Time Progress Bar ends the Learning Point. On expiry each group is judged once (`evaluateCheckpoint`): on-target groups continue, others get `qualified = false`, become spectators for the rest of the adventure (never auto-retry, teacher cannot advance them) and see the teacher-editable `class_games.group_completion_message` (default in `DEFAULT_GROUP_COMPLETION_MESSAGE`). Never label them "failed".

Outcomes are written only by the teacher dashboard (`useGroupOutcome` with `authoritative: true`); students read the same state.
