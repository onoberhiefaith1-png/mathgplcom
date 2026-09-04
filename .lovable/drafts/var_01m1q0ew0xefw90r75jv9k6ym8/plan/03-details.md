## What the teacher sees

- The question page and question list show **Media** where **Add Video** used to be. If media is already saved, the button reads **Edit media** and states which kind it is.
- Choosing Video keeps everything as it is today: upload, set each line's start and end, preview, save, and the side-by-side video the students already get.
- Choosing Audio gives the same panel with an audio player in place of the picture. Same start/end fields per line, same preview, same save.
- Once saved, the timeline is shown as a read-only summary with a lock note and an **Edit** button. Timing fields cannot be changed until Edit is pressed. Saving again locks it again.
- Removing media is still possible from inside the editor.

## Students

Unchanged behaviour. For video, the same side-by-side player and per-line timing. For audio, the same per-line timing with a plain audio player and no video area at all. Students always get the saved timings, never recomputed ones.

## Technical section

**Step 1 — confirm the cause.** For a question with saved timings, compare the keys stored in `course_blocks.config.questionVideos[<questionId>].segments` against the line ids produced by `videoLinesFromQuestion` for (a) the stored question payload and (b) the freshly prepared test board used by `TeacherExerciseQuestionsPage`. If the keys do not match, line identity is drifting and that is the fix; if they do match, trace the reset in the editor's draft lifecycle instead. Do not implement the persistence changes before this read.

**Line identity.** If ids drift, persist a stable per-line identity in the saved record: store an ordered key list at save time (`sectionOrder`) alongside `segments`, and resolve by position when a key no longer exists, so an already-saved timeline never degrades to "unset". Keep `lineId` as the primary match.

**Storage.** Extend the existing record in `course_blocks.config.questionVideos[questionId]` — no new table. Added fields: `mediaType: "video" | "audio"` (absent means video), `locked: boolean`, `savedAt`. `videoPath` continues to hold the single media reference for both types. One record per question, so no duplicates.

**Editor.** `QuestionVideoEditor` becomes the media editor:
- Draft initialisation only from the loaded config; `emptyVideoConfig()` is used solely when nothing has ever been saved for that question. Remove any effect that reinitialises the draft while the dialog is open, and never derive start/end from `duration` for saved sections.
- New locked mode: when `config.locked` is true, render the saved sections read-only with **Edit**; Edit sets a local `unlocked` flag (does not write to the database). Save writes `locked: true`.
- Media type: a small chooser before upload (`Video` / `Audio`); after upload it is fixed for that record. Audio renders an `<audio>` element through the same `courseMediaUrl` resolution and the same playhead/preview handlers; `uploadCourseMedia` already accepts any file.
- Entry points in `TeacherExerciseQuestionsPage` and the question list get the Media label plus a type selection step; `openEditor` keeps loading from the store.

**Playback.** `QuestionVideoPane` gains an audio branch: same section timing, same play/pause and boundary logic, element swapped for `<audio>` and the video frame not rendered. `sectionsFor` and friends stay untouched — they already treat timing as markers.

**Tests.** Extend `questionVideoStore.test.ts` for `mediaType`/`locked` round-tripping, and add a test that a saved config with an unknown line key still resolves its ranges by order rather than reporting them unset.
