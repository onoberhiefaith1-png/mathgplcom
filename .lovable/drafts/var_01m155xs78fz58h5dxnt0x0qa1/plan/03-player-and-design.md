## A proper player

- Play/pause, replay, previous/next teaching section, volume, fullscreen — plus free scrubbing along the section bar, click the picture to pause/resume, and keyboard control (space, arrow keys, F, M).
- Controls fade away while watching and return on hover, tap or focus.
- Crisp picture: whole-pixel fit to the video's own aspect ratio, no upscaling, full-quality preload, `object-contain` so nothing is stretched, blurred or cropped.
- Audio stays on by default; the "tap to enable sound" prompt appears only when the browser actually blocks it.
- Guided behaviour is preserved: the mathematics still drives the video, sections still stop at their end checkpoint, Introduction and Conclusion still work.

## Student journey redesign

Same design language as the teacher's surfaces, using existing tokens — no new palette.

- **Solving screen**: slim professional header — back, course/question title, question N of M, marks earned/total, progress bar, and the Smartboard / Split view / Video switcher — then the stage below it.
- **Split view**: balanced two-pane on desktop, stacked with a clean divider on phones; neither pane overflows.
- **My Courses**: course cards with cover art, progress ring, status chip, section/exercise/marks facts and one clear primary action.
- **Course runner**: sectioned reading flow with numbered sections, block cards, sticky continue bar, completion state.
- **Exercise question list**: rows showing marks earned, a solved tick, a video badge where a teaching video exists, and a pass-mark summary on top.
- Mobile first: 44px touch targets, no horizontal scroll, safe-area padding.

## Technical notes

- `src/pages/student/AssessmentBoardPage.tsx` — wrap board/frame in a `h-[100dvh]` flex stage; pass question index, total and marks to a new `StudentBoardHeader`.
- `src/components/smartboard/ThreeViewFrame.tsx` — drop the fixed floating pill, keep the single-mount player, provide `SmartboardRootContext` from the board wrapper so `SensorDPad` and `FloatingNumberPanel` portals land inside it, and mark the inactive pane `inert` rather than only visually hidden.
- `src/components/smartboard/QuestionVideoPane.tsx` — seekable progress bar (pointer drag → `currentTime` clamped to the active section), click-to-toggle overlay, auto-hiding control bar, keyboard handlers on the player root, rounded fitted box, `preload="auto"`, higher z-index while expanded.
- New `src/components/student/StudentBoardHeader.tsx` and `src/components/student/BoardViewSwitcher.tsx`; view state and its `localStorage` persistence stay in the frame.
- Restyle `StudentCoursesPage.tsx`, `StudentCourseRunnerPage.tsx` and `StudentExerciseQuestionsPage.tsx`; the existing `StudentView` course renderer is reused unchanged for content.
- No changes to marking, progress writes, assessment data, teacher surfaces, or the store-once video reference model — the player keeps streaming the original asset.

## Verification

- As a student, open a course exercise question that has a teaching video: it renders in all three views, play/pause/scrub/volume/fullscreen respond, audio matches the picture, and the board keeps its state across view switches.
- Check phone, tablet and desktop widths.
