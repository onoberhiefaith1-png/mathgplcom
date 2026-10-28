# Speed Builder — video segmentation and timeline fix

The teaching-video editor currently derives every section's start from the section above it and treats every unset marker as `0:00`. That is why lines appear pre-filled with `0:00`, why editing one boundary can appear to move another, and why the video scrolls away with the line list. Nothing about the lesson-note, highlighting, floating-number, presenter or Smartboard logic changes.

## What changes for the teacher

1. **Video stays put.** The dialog becomes a two-part layout: the player, playhead, and Set start / Set end controls sit in a fixed header; only the Introduction → Line 1 → … → Line M list scrolls beneath it. Scrolling to Line 12 never hides the player or its controls.
2. **Explicit "Not set".** A line with no teacher-chosen boundary reads `Start: Not set` / `End: Not set` instead of `0:00`. `0:00` only ever appears because the teacher chose second 0.
3. **End confirms → next start is prepared immediately.** Setting Line 1's end to `01:15` instantly writes Line 2's start as `01:16` (end + 1s) and leaves its end unset. No refresh, no reopening the row.
4. **Both boundaries editable.** Start and end are each editable text fields plus a "use playhead" button. A prepared start is only a suggestion.
5. **No chaining.** Editing Line 2's start never touches Line 1's end. Gaps (`00:31 → 00:45`) and overlaps (`00:00–01:00`, `00:50–01:30`) are both allowed and are never auto-corrected. At most a quiet informational note, no forced repair.
6. **Clear per-line state.** Each row shows one of: `Not set`, `prepared` (auto-suggested start), `set` (teacher-edited), plus `✓ Line configured` once both boundaries exist.
7. **Introduction stays optional**, numbered lines stay required.

## Student playback

Unchanged in principle: one uploaded file, seek to the line's stored start, stop at its end, never roll into the next line. A line whose range is not configured simply has no video segment — the player shows nothing for it rather than inventing an even slice.

## Technical notes

- `src/lib/courses/questionVideo.ts`: `VideoSegmentMarker.start/end` become `number | null`, stored per section key (`line:<lineId>`, `intro`, `conclusion`) — identity stays keyed to the line ID, never array position. `sectionsFor` stops chaining, stops even-splitting and stops clamping one section against another; it returns each section's own stored values verbatim plus a `configured` flag. Legacy records (end-only `checkpoints`, and existing `segments` written by the old chaining logic) are read once and adopted as explicit start/end pairs so saved videos keep playing.
- New pure helper `prepareNextStart(sections, key, end)` implementing end + 1s, applied only to the immediately following section and only when its start is unset or previously auto-prepared. A `startSource: "auto" | "manual"` flag per marker distinguishes prepared from teacher-edited so a manual start is never overwritten.
- `overlapsFor` / `emptySectionsFor` become advisory only: the save path no longer blocks on overlap or gap; it blocks only when a line has a start after its end.
- `src/components/coursebuilder/QuestionVideoEditor.tsx`: split into a non-scrolling player header and a `min-h-0 overflow-y-auto` line list inside a fixed-height dialog body; per-row start and end inputs; state updates go through the new helpers so the next start appears in the same render.
- `src/lib/courses/questionVideoStore.ts`: persists nullable start/end and `startSource` in the same `course_blocks.config.questionVideos[questionId]` record — no schema change, no new table.
- `src/components/smartboard/QuestionVideoPane.tsx`: treats an unconfigured section as "no segment" instead of a zero-length slice.
- Tests extended in `src/lib/courses/__tests__/`: the exact acceptance scenario (intro 0:00→0:30, Line 1 prepared at 0:31, end 1:15, Line 2 prepared at 1:16, manual edit to 1:30 leaves Line 1 at 1:15), plus gap/overlap tolerance, no cross-line leakage, and legacy-record adoption.
