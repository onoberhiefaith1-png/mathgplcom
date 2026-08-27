# Question Test Smartboard + Video — fix and finish

The architecture you described is already the one in place: the question list opens the **existing** Test Smartboard, and the video is layered on top of it with the three-position control. Nothing is redesigned here — three concrete faults are fixed.

## What is actually wrong

1. **View Exercise is slow.** Confirmed in the loading code: opening the page first waits for a full class-wide re-sync of every exercise card, then resolves the card's question links **one at a time**, each link running its own lookups and a full lesson-note compile before the next starts. Nothing renders until all of that finishes.

2. **Video save fails.** Confirmed against the database: no `question_video` table exists in the project yet. The video table was written as a staged change for this draft, so the app is querying a table the live database does not have — hence the "could not find the table in the schema cache" error. It starts existing the moment this draft is accepted into the project.

3. **Video load per question** works from the correct `(exercise card, question)` pair already, but it is fetched separately after the board mounts, so a saved video can appear a beat late. It will be loaded with the question instead.
