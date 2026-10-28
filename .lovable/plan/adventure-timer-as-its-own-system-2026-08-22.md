# Adventure — Timer as its own system

The Progress Bar keeps doing exactly what it does today: it measures achieved score against the required target. A new **Timer** system is added beside it, reusing the existing segmented and fillable bar visuals (and their effects) but driven purely by elapsed time. A third Timer display mode, **Video Timer**, turns an uploaded video into the clock: intro plays once (untimed), a loop region repeats for the configured duration, and an outro plays only on failure.

## What already exists (reused, not rebuilt)

- Progress bars already carry a role (`time` / `learning`), and the time bar is already excluded from questions and scoring — so the two systems are already separated in data. This work turns that reserved bar into a first-class **Timer** with its own settings, its own display modes, and its own success/failure outcome.
- Live clock, start/pause/resume/reset, expiry and realtime mirroring already exist (`game_time_bars` + `useGameTimeBar`). The Timer builds on that row; no new clock.
- Segmented and fillable (liquid) bar rendering, styles and effects already exist and are shared — the Timer selects a display mode and feeds them a time fraction instead of a score fraction.
- Video loop regions (Loop Start / Loop End per scene) and the loop state machine already exist for Video Adventure; the Video Timer reuses that region logic for its own intro/loop/outro timeline.

## Editor changes

1. **Add-element menu**: alongside "Progress Bar", add **Timer**. Adding a Timer creates the role-`time` bar; adding a Progress Bar creates the role-`learning` bar. The Progress Bar option, its questions, scoring and goal settings are untouched.
2. **Timer settings panel** (shown when the Timer is selected):
   - **Duration** — free entry in minutes (and mm:ss), replacing the fixed dropdown; keeps "None".
   - **Display** — Segmented Bar (default for a new Timer) / Fillable Bar / Video.
   - Segmented: number of segments; each segment automatically equals duration ÷ segments (shown as "each segment = 2 minutes"). No per-segment configuration.
   - Fillable: existing liquid/fill settings and effects, unchanged.
   - All existing bar appearance and effect sections stay available to the Timer.
   - **Failure** — Failure Message (default "You didn't complete the challenge in time."), optional Failure Narration (uses the existing narration upload/playback), and, in Video mode, the outro region acts as the failure video.
   - Only the sections relevant to the selected display mode are shown.
3. **Video Timer authoring**:
   - Upload video (reuses the existing game asset upload).
   - A timeline with three draggable marker pairs: **Intro — not timed**, **Loop — timed**, **Outro — failure ending**, with the computed loop duration displayed ("Loop duration: 10 seconds — repeats for 15 minutes").
   - Preview Intro / Preview Loop / Preview Outro / Preview Full Scene buttons, playable without starting a student session.
4. **Test Timer on the Adventure page**: a Start Test control that runs the Timer locally against the existing preview/Next flow, so the teacher can watch the bar (or video loop) advance proportionally while stepping through the adventure. Test state is local; it never writes the live session clock.

## Runtime behaviour

- Timer fill = elapsed ÷ configured duration. Progress fill = score ÷ required score. Neither ever reads the other.
- Bar modes: when the Timer reaches its end, the required score is checked. Passed → advance as today. Not passed → show the teacher's Failure Message, end the stage, and leave the Progress Bar exactly where the student left it.
- Video mode: intro plays once, then the Timer starts and the loop region repeats. On expiry the loop stops immediately; if the student failed, the outro plays, then the optional Failure Narration, then the stage ends. If the student passes early, the Timer and loop stop at once and the adventure advances — the outro and failure narration never play and are never queued into the normal narration sequence.
- Timer starts only when the teacher starts the real session (existing Start control on the Adventure dashboard, which also carries duration and required score).
- Progress Bar and Timer can be displayed together and are labelled distinctly ("850 / 1000" vs "08:12 remaining").

## Technical notes

- `src/lib/games/types.ts`: extend `ProgressConfig` for the Timer additively — `timerDisplay?: "segmented" | "liquid" | "video"`, `failureMessage?`, `failureNarrationPath?`, and a `timerVideo?: { assetId, storagePath, introStart/introEnd, loopStart/loopEnd, outroStart/outroEnd }` block. Keep `timeDurationSeconds` as the duration. Legacy bars keep working: missing `timerDisplay` falls back to the bar's existing `barType`.
- `src/components/gamebuilder/SettingsPanel.tsx`: replace the current time-bar branch with the Timer panel described above (duration input, display picker, segment maths, video timeline, failure fields), leaving the learning-bar branch untouched.
- New `src/components/gamebuilder/TimerVideoTimeline.tsx` (marker dragging + preview) and `src/lib/games/timerVideo.ts` (pure helpers: clamp regions, loop duration, laps needed, next-phase resolution) so the same logic serves editor preview and gameplay.
- New `src/lib/games/timerOutcome.ts`: pure resolver `resolveTimerOutcome({ expired, passedEarly, scoreMet })` returning `pass | fail_message | fail_video`, consumed by `GamePlayPage.tsx` and `AdventureDashboardPage.tsx` so both surfaces branch identically.
- `src/pages/GameEditorPage.tsx`: add the Timer entry to the add menu (mapping to the `time` role, default segmented) and the local Start Test clock.
- `src/pages/student/GamePlayPage.tsx`: on Timer expiry, run the outcome resolver — failure message overlay for bar modes, outro + failure narration for video mode — and never mutate progress on failure.
- Timer fill is computed from `useGameTimeBar` elapsed/duration and passed to the existing bar renderer; no new bar component.
- No database migration: `game_time_bars` already holds the clock and the new settings live inside the canvas JSON.
