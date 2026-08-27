# Fix: "invalid input syntax for type uuid" when opening a question from an Exercise Card

Confirmed cause (from the code and the live database, not a guess):

- The hidden test container for an Exercise Card question is looked up and created with `question_key = "<cardId>:<questionId>"` — two ids joined by a colon (`src/lib/courses/exerciseBoard.ts`, `openExerciseQuestionTestBoard`).
- In the database, that field on the assessments table is a **uuid** column, not text. A joined pair can never be a uuid, so every open fails with exactly the message on screen: `invalid input syntax for type uuid: "b495f550-…:f2039634-…"`.
- The Floating Numbers test board works because it stores a single uuid there.

So the board itself is fine — only the key used to find/create its hidden container is malformed.
