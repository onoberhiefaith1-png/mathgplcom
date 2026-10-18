# Academia rules

- Academia Play opens only the card's own question (boards filtered by the activity's subsection); Level map/arranging hidden there, normal Games keep Levels.
- Question cards store an AI `question_design` (verbatim maths, lock-checked, plain fallback) or a teacher picture; each distinct question sent to a Session is its own card.
- Multiple-choice papers (`academia_mcq_*`, `src/lib/academia/mcq`, `/mcq/*`) attach to a Subject, not a Session, and never touch Practice/Play/Game; opened only via the subject ⋯ menu.
- An Academia Session Adventure is an `adventure` activity (ref_id = `games` id, class_id = hidden Academia class); questions go onto its progress bars via `adventure_bar_questions`, so one Adventure serves many Sessions uncopied.
- Academia Session Adventures open at `/academia/adventure/$activityId`, reusing the student video player in self-paced mode (own marks vs the bar's pass mark, default 100%), so teachers and students share one player.
