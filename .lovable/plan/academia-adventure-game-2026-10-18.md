# Academia Adventure + Game

Everything here applies only to Adventures inside Academia Sessions. The standalone Adventure (its Smartboard, its class links, `/adventure` pages) and the normal Game stay exactly as they are. Academia Question Cards stay unchanged.

## 1. Assign window: learning-point slots

In the lesson note Assign window → Academia → Session → Adventure (e.g. "Becoming"):

- Below the Adventure, a heading "Progress bar" with one foldable slot per learning point: "Learning Point 1 · Progress bar 1", "Learning Point 2 · Progress bar 1", etc.
- Each slot is identified by its learning point, never by its name. Bars sharing a default name never share questions.
- Opening a slot lists its questions, one row each, cut off at the edge and scrollable sideways to read the rest.
- Up/down arrows change the question order; an X removes a question from that slot only (the lesson note and other copies stay).
- Each slot header shows its question count and total marks, updated as soon as a question is added.
- Each slot has its own pass mark, 100% by default, which can be raised or lowered.
- The Assign button adds the question to the slot you have open.

## 2. Session: choose a Game for the Adventure

On the Session's Adventure card, an "Add Game" button opens a searchable list of your existing Games with a preview. The chosen Game is saved to this Session's Adventure only, so other Sessions using the same Adventure can pick a different Game.

## 3. Playing an Academia Adventure

```text
video plays  ->  learning point (loop)  ->  Game appears over the video
                                              solve questions one by one
                                              progress bar fills with score
pass mark reached  ->  Game disappears  ->  video continues  ->  next learning point
```

- Between learning points: only the video. No Game, no HUD.
- At a learning point the video loops and the chosen Game's writing surfaces appear in front of it. The Game's own background (picture or video) is hidden; the Adventure video is the background.
- Everything else from the Game comes along: writing surfaces, score, lives, rewards, Vaults, sounds, character, hourglass.
- No Smartboard/whiteboard opens, and the student never clicks a progress bar to see questions. Questions belong to the learning point and appear straight away, in the teacher's order.
- Finishing a question moves it up and brings the next one in from below. Students can scroll back to an earlier question or skip one; their working is kept. No ordinary Game completion screen between questions.
- The progress bar rises with the score (earned marks of that learning point's total), counted once per question.
- When the score reaches the pass mark: results saved, Game hidden, loop released, video continues. The next learning point stays locked until then.
- If a question has a time (time mode), that time drives the learning point's time bar, which fills from bottom to top. An hourglass adds time to both the Game timer and the bar together, applied once.
- Works on phones and desktop; attempts are saved per student per Session.

## 4. Fixes to the current Academia Adventure

- Stop opening the Smartboard/assignment board inside Academia Adventures.
- Questions keyed to the learning point, with the pass mark read from that slot.

## Game lock

The Game is owner-locked. Approving this plan is treated as your unlock for one change only: an "embedded in Academia Adventure" mode (background hidden, questions supplied by the learning point, no completion screen between questions, score and time reported out). The normal Game is unchanged when not in this mode, and the lock check is run and the baseline updated after tests pass.

## Technical details

- Data: add `academia_adventure_points` (activity_id, scene_id, bar_id, pass_pct default 100) and `game_id` on the Adventure `academia_activities` row (new column `game_ref_id`). Reuse `adventure_bar_questions` rows scoped by the hidden Academia class + `progress_element_id`; add a `position` column for ordering. All keys include scene id so identical bar names cannot collide. RLS mirrors existing academia_activities policies.
- `AcademiaAssignPicker.tsx`: replace the flat "Progress bar" select with collapsible slots built from `collectLinkableBars`; reorder/remove/pass-mark helpers in `src/lib/academia/api.ts` with pure helpers + tests (slot isolation, mark totals, default 100%, 70% pass).
- `AcademiaAdventurePage.tsx`: new `AcademiaAdventurePlayer` reusing the Adventure video/loop layer (`VideoBackgroundLayer`, checkpoints) and mounting `ImaginePlayPage` in an `embedded` mode via props (`backgroundOverride="none"`, `questions`, `onScore`, `onTimeChange`, `onPassed`). `GamePlayPage` (standalone) is no longer used by this route; it remains unchanged elsewhere.
- Time bar: Academia-only bar component with bottom-to-top fill fed by the Game clock; hourglass events go through the existing clock so both stay in sync.
- Pure helpers for pass check and score-to-progress in `src/lib/academia/adventurePlay.ts` with tests; update `src/lib/academia/AGENTS.md` and Game AGENTS notes.
