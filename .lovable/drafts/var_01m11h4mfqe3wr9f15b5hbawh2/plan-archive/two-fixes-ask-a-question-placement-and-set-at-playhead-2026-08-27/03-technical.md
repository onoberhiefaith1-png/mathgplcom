## Technical notes

**Ask a Question**
- `src/components/smartboard/PresentationView.tsx`: the render condition adds `&& !testMode`, so the teacher's Exercise-Card test board (mounted with `role="student"` + `testMode`) never shows it. Live/Smart Card and view-only exclusions stay as they are.
- `src/components/notifications/AskQuestionButton.tsx`: container moves from `absolute bottom-4 left-4` to a top-right anchor (`top-4 right-4`, with a right offset that clears the existing marks/close and floating-number chrome), and the expanded panel opens downward from there. No change to `askQuestion` or its context payload.

**Set at playhead**
- `src/lib/courses/questionVideo.ts` — `sectionsFor`: when a section has an explicit `segments` marker, stop seeding `start` from the previous section's `end` and stop advancing `prev` through marked rows. Clamp only to `[0, duration]` and `end >= start` for that row. Sections with no marker keep today's even-slice fallback. Add a small `overlapsFor(sections)` helper returning the keys whose ranges overlap or run backwards, for the row warning.
- `src/components/coursebuilder/QuestionVideoEditor.tsx` — `setMarker` writes into `draft.segments` by key directly (creating the entry from the currently displayed values when absent) rather than rebuilding the whole marker list from `markersFor(sectionsFor(...))`; setting `end` below `start` moves `start` to match. `Set at playhead` uses `videoRef.current?.currentTime ?? playhead`, is disabled only on `!draft.videoPath`, and fires a short toast with the written time. The time `Input` becomes controlled by the section value so the field updates the instant the marker changes.
- `checkpoints` continues to be written from each section's `end` for backwards compatibility with existing saved videos.

**Tests** (`src/lib/courses/__tests__/`)
- marking a later section does not move earlier ones;
- a boundary earlier than the previous section's end is stored as written;
- `end` earlier than its own `start` pulls `start` down;
- `overlapsFor` flags a backwards/overlapping pair;
- unmarked sections still fall back to even slices, and `sectionForLine` still resolves the right slice for playback.
