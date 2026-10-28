# Fix Adventure linking at the database boundary

## Confirmed diagnosis

- The live database contains `class_adventure_notes` and `class_game_boards`, but **does not contain** `class_adventures` or `adventure_bar_questions`.
- No differently named Class-to-Adventure relationship table exists. The existing tables represent the old lesson-note assignment and per-progress-bar board models, so reusing either would restore the architecture being replaced.
- The application already queries `class_adventures`, and the required schema is currently only staged in this draft. That is why selecting Runtown reaches the database but fails with “not found in the schema cache.”
- The staged change needs tightening before it is accepted: align question identifiers with the existing UUID convention, add the missing section relationship, retain explicit grants and class-scoped security, and ensure unlinking does not erase class-specific work.

## Outcome

A class can link multiple existing Adventures, and one Adventure can be reused by multiple classes. Questions are then placed independently on each linked Adventure’s progress bars, with all placement, scoring, and progress isolated by **Class + Adventure + Progress Bar**.

Existing Adventures, classes, lesson notes, questions, progress bars, assignments, and student results remain intact. The Adventure editor and Game workflow are not changed.
