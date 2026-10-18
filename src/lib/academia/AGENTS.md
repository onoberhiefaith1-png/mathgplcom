# Academia rules

- Academia Play opens only the card's own question (boards filtered by the activity's subsection); Level map/arranging hidden there, normal Games keep Levels.
- Question cards store an AI `question_design` (verbatim maths, lock-checked, plain fallback) or a teacher picture; each distinct question sent to a Session is its own card.
- Multiple-choice papers (`academia_mcq_*`, `src/lib/academia/mcq`, `/mcq/*`) attach to a Subject, not a Session, and never touch Practice/Play/Game; opened only via the subject ⋯ menu.

- An Academia Session Adventure (`adventure` activity: ref_id = Adventure, game_id = chosen Game) keeps its own question copies per learning point in `academia_adventure_questions` and pass marks in `academia_adventure_points`, keyed by scene id so same-named bars never share questions.
- `/academia/adventure/$activityId` plays the Adventure video with the Game embedded over each loop (ImaginePlayPage `offline.embedded`, background hidden); never the Smartboard player, so standalone Adventures stay unchanged.
- Academia Adventure owns one Game music track per attempt (`holdBackgroundSound` in `src/lib/slate/gameSound.ts`) and ducks it from the teacher's per-activity `academia_activities.audio` via pure `adventureMix.ts`, so questions and learning points never restart sound and the Game's own settings stay untouched.
