# Fix Video Adventure Question-to-Progress-Bar Linking

Goal: a Lesson Note is assigned as a whole to one normal Progress Bar (one checkpoint), Time Progress Bars never appear in the linking flow, and every assigned bar can be unassigned and reused.

## What is already correct

- Linking assigns the **whole** Lesson Note (all its questions), not individual questions — the link dialog stores the full question set for the chosen bar.
- The dialog already filters out bars explicitly marked as the Time Progress Bar.
- Scoring, solving and checkpoint progression logic already exist.

## What is broken and will change

### 1. Time Progress Bars still appear for older adventures

Bars created before the two-bar architecture carry no stored role, and the current rule treats any role-less bar as a question bar. So in existing Video Adventures the reserved first bar of each Learning Point still shows up on the linking page.

Fix: infer the reserved role per Learning Point — when a Learning Point has no explicitly marked Time Progress Bar, its first Progress Bar is treated as the Time Progress Bar everywhere (linking list, dashboard controls, gameplay). This is read-time inference only; no adventure data is rewritten.

### 2. Bars are not shown grouped by Learning Point

The bar list is a flat list. It will be grouped under each Learning Point heading (Learning Point 1, Learning Point 2, …), showing only the assignable bars, with the reserved Time Progress Bar silently omitted.

### 3. One Progress Bar can hold more than one Lesson Note

Today re-linking a bar silently overwrites whatever was there. Instead:

- Each bar in the list shows its current state: empty, or the assigned Lesson Note with its question count.
- An already-assigned bar cannot be picked. Selecting it shows: "This Progress Bar already has a Lesson Note assigned. Please unassign the current Lesson Note before linking a new one."
- Each assigned bar gets an **Unassign** button in the list. Unassigning frees the bar immediately so a new Lesson Note can be linked without leaving the dialog.
- Re-linking the *same* Lesson Note to the same bar (refreshing marks) stays allowed.
- A Lesson Note may still be assigned to as many different bars as the teacher wants.

### 4. Adventures page mirrors the same rule

On the Adventures page, each linked entry is labelled by its Learning Point and bar, and the existing remove control is relabelled **Unassign** with a confirmation, so both places speak the same language.

## Gameplay

No change to solving or scoring. The checkpoint rule already in place is verified end to end: a student at a Progress Bar opens that bar's Lesson Note, answers all questions, and the bar fills only when the required score is reached; the Time Progress Bar is excluded from question progress.

## Technical notes

- `src/lib/games/types.ts`: add per-scene reserved-bar inference (`reservedTimeBarOf(scene)` / `questionBarsOf(scene)`) used by `isTimeBar` consumers, so legacy canvases resolve a Time Bar without a migration. Existing helpers (`timeBarOf`, `sceneTimeSeconds`, `checkpointsMissingTime`) delegate to it.
- `src/components/adventures/LinkAdventureDialog.tsx`: build the bar list from `questionBarsOf` per scene, grouped by scene title; load existing `class_game_boards` rows for the chosen game to compute occupancy (notebook title + question count); block occupied bars with the message above; add an Unassign action that deletes the board row and its assessment then refreshes occupancy.
- `src/pages/class/ClassAdventuresPage.tsx`: reuse the same occupancy/labelling helper, rename the remove control to Unassign, and show the Learning Point name alongside the bar label.
- Extract the shared occupancy query into `src/lib/adventures/barLinks.ts` so dialog and page cannot drift.
- Quiet fix included: the Time Bar realtime channel currently registers its listener after `subscribe()` in some remounts (console error on the Adventures page) — the subscription setup in `src/hooks/useGameTimeBar.ts` will be corrected to bind before subscribing.
- No database changes: no schema, no new tables.
