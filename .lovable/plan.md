# Bring back My Adventures and link questions Session → Adventure

## What is wrong today
- "Adventure" / "My Adventures" opens the Adventure portal, whose only button ("Game Mode") goes to the Game. The old "My Adventures" list and video editor are still in the app but no page opens them: the old addresses now forward to the Game.
- In an Academia Session, "Adventure" cards just open the portal page, not the chosen adventure.

## 1. Adventure opens your adventures again
- `/adventure` shows **My Adventures**: your video adventures (like *The Becoming*) with Create, Rename, Delete and covers, the same list as before.
- Clicking one opens the video Adventure editor (videos, progress bars, loops), not the Game.
- `/adventure/games` and `/adventure/games/<id>` open that list and editor again instead of forwarding to the Game. The Game stays at `/game` and doesn't change.
- Links from Community, the student pages and the editor's Back button go to My Adventures.

## 2. Session → Add Adventure
On the Session page (school workspace, teachers assigned to the subject):
- New **Add Adventure** button next to the existing add-activity buttons.
- Step 1: pick one of your adventures from a list with covers.
- Step 2: pick or upload the video the Session should use (an existing scene video in that adventure, or a new upload stored with the Session's media).
- The Adventure shows as one card at the end of the Session (after the question cards), labelled Adventure. Students open it to play the adventure. It doesn't open the Game or Practice.

## 3. Assign a question to an Adventure progress bar
From the lesson note / Floating Numbers **Assign** window, new choice **Academia → Adventure**:

```text
Academia (fixed) → Class → Subject → Topic → Subtopic → Session
   → Adventure (added to that Session) → Progress bar (checkpoint)
   → Assign
```
- Only adventures already added to that Session appear in the list.
- The question, with its diagram, lands on that progress bar. When the video reaches the checkpoint, the bar's questions appear on the video.
- Assigning again to the same bar adds the next question in order. Nothing is copied into the adventure itself, so one adventure can serve many Sessions.

## Pipeline

```text
Adventure (video shell, reusable)
     │ added to
     ▼
Session ──► Adventure card (chosen video)
     ▲
     │ Assign → Academia → … → Session → Adventure → Progress bar
Lesson note / Floating Numbers question (+ diagram)
```

## Not changed
- The Game, Game Pro, Game Levels, Courses, Practice and Play chaining.
- Class Adventures outside Academia (the Link Adventure flow) keep working as they do now.

## Technical details
- Re-add routes for `AdventureGamesDashboard` (`/adventure/`) and `GameEditorPage` (`/adventure/games/$gameId`). `/adventure/games` should forward to `/adventure`. Swap the portal's "Game Mode" button for My Adventures. Update the lock/AGENTS note that said `/adventure/games` forwards to `/game` (that applied only to the archived 3D game ids, which still go to `/game/slate/$id` when the id isn't a video adventure in `games`).
- Fix the Academia catalogue: the `adventure` kind reads `games` (video adventures, own workspace via `listLinkableAdventures`) instead of `adventure_games`. `activityRoute("adventure")` returns the adventure player for `ref_id`, scoped to the Session.
- Migration (additive): nullable `video_path` and `adventure_bars jsonb default '{}'` on `academia_activities` (bar id → ordered question keys + question payload with `objects`). RLS should match existing activity write rules.
- `assignToAcademiaAdventure({ activityId, barId, notebookId, subsectionId, ... })` in `src/lib/academia/api.ts`. A new "Adventure" option in `AcademiaAssignPicker` adds the Adventure and Progress bar selects, with bars read from the adventure canvas.
- Tests: the catalogue's adventure kind reads `games`; assigning appends to the right bar in order.
- Before building: check on a real Session that existing `adventure` activities point to `adventure_games` ids. If they do, keep them openable.
