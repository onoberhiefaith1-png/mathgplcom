# Timer — delete, cleaner settings, preview stepping, working video regions

Five fixes to the Timer settings panel so the Timer behaves as completely as the Progress Bar.

## 1. Delete at the top

The Timer currently hides the delete (and duplicate) buttons because it is treated as system-owned. Add the delete button to the Timer header, exactly like the Progress Bar's. Removing the Timer clears the timing element from the scene; adding a Timer again from the toolbar recreates it with default settings.

## 2. Remove the minute dropdown

The "5 minutes / 10 minutes / Custom…" dropdown goes away. Duration is a single free-entry field (mm:ss or plain minutes), which already exists next to it. The short helper line stays so "None" is still explained.

## 3. Video mode hides Fill style / Energy

When Display = Video, the Fill style and Energy sections disappear (as Style already does). The video is the visual; slot colours and energy fields have no meaning there.

## 4. Nest preview for Segmented and Fillable

Mirror the Progress Bar's step preview, but driven by time instead of marks:

- Segmented: a "Nest" stepper advances one segment per step and shows "10 minutes / 10 segments — one bar rises each 1 minute", so the teacher watches bars rise exactly as students will.
- Fillable: the same stepper raises the fill in even percentage steps (10%, 20%, …) with the elapsed/remaining clock shown.
- Reset returns the preview to empty. This is editor preview only — it never writes the live session clock or the student's score.

## 5. Video timer regions no longer stuck at 0:00

Cause: the region numbers are derived from a video duration that is only stored after the metadata event is persisted back into the element, so before that lands every region clamps to 0 and the Start/End fields look uneditable.

Fix: read the duration from the video element into local state as soon as metadata (or `durationchange`) is available and use it for the regions immediately, persisting it in the background. Also:

- Default the three regions on first load of a new video (intro = first third, loop = middle, outro = last third) instead of leaving zeros.
- Show each field in mm:ss.ss with a range hint ("0 – 15.0s") and keep ordering valid while typing (intro ≤ loop ≤ outro).
- Preview buttons stay disabled until a usable loop region exists, with a short explanation instead of silently doing nothing.

## Technical notes

- `src/components/gamebuilder/SettingsPanel.tsx`: show delete for the time bar; drop the `TIME_DURATION_OPTIONS` select from the Timer branch; gate the Fill style and Energy sections on `timerDisplay !== "video"`; add the Timer preview (`Nest` / `Reset`) section for segmented and liquid, using local state plus existing bar rendering.
- `src/components/gamebuilder/TimerVideoTimeline.tsx`: local `videoDuration` state fed by `onLoadedMetadata`/`onDurationChange`, passed to `timerRegionsOf(value, videoDuration)`; seed default regions once per new video; clamped mm:ss inputs; preview guarded by `timerVideoReady`.
- No data-model or database change: `timerDisplay`, `timeDurationSeconds` and `timerVideo` already exist on `ProgressConfig`.
