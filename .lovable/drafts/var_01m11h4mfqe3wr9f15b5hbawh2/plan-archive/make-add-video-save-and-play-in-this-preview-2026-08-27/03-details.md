## Behaviour after the fix

- Save Video succeeds immediately in this preview; the toast confirms the save.
- Reopening the question shows the saved playhead length, segment times and the Introduction/Conclusion toggles exactly as saved.
- The Play Screen and the three view modes (Main, Split, Video Only) appear only once a video is saved, and stay one continuous session when the layout changes.
- Students see the "video" tag on the questions that have one, and the same segments.
- Replace video overwrites the same question's video; removing it clears the tag.

## Technical detail

`src/lib/courses/questionVideoStore.ts` — same public API (`loadQuestionVideo`, `loadCardVideoFlags`, `saveQuestionVideo`, `removeQuestionVideo`), new backing store:

- Read/write `course_blocks.config.questionVideos` as a map `questionId → { videoPath, duration, segments[], checkpoints, introEnabled, conclusionEnabled }`.
- Save = read current `config`, merge the one question's entry, update the row. Owner-only writes and student reads are already covered by the existing `course_blocks` policies (owner ALL, published-course SELECT), so no new policy is needed.
- `loadCardVideoFlags` derives the set from that map in one read — no extra query.
- Drop the `PGRST205` / "schema cache" special case; genuine failures surface their real message.
- Delete the staged `exercise_question_videos` migration so the unused table is never created.

Callers (`QuestionVideoEditor`, `ThreeViewFrame`, teacher and student exercise pages) keep their imports unchanged.

## Testing

- Unit test in `src/lib/courses/__tests__/` covering save → load round trip, segment ordering, per-question isolation inside one card, and the video flag set.
- Live check in the preview with a browser run: open an Exercise Card question, attach a video, save, confirm the success toast, reload the question and confirm the segments persisted and the Play Screen appears.
