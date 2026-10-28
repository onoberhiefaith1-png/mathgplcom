## Technical detail

**`src/components/smartboard/QuestionVideoPane.tsx`** (presentation only)

- Add a `ResizeObserver`-backed measurement of the stage element plus `ratio` state set from `onLoadedMetadata` (`videoWidth / videoHeight`, fallback `16/9`).
- Compute `fit = min(w / ratio_w, h / ratio_h)` and apply the resulting width/height to an absolutely centred wrapper around the existing `<video>`; keep `object-contain`.
- Add a full-screen toggle button next to the existing controls: `el.requestFullscreen()` / `document.exitFullscreen()` on the pane root, tracked with a `fullscreenchange` listener; fall back to a `fixed inset-0 z-[80]` class when the API rejects.
- Controls move into an absolutely positioned bottom overlay (`absolute inset-x-0 bottom-0`) with a soft top-to-bottom scrim; no change to their handlers or to `onTimeUpdate` / checkpoint logic.
- Surround styling: `bg-[#0b0f14]`-class dark neutral via existing tokens plus a subtle gradient; remove the outer black rounded padding block that currently reads as a card.

**`src/components/smartboard/ThreeViewFrame.tsx`**

- Replace the fixed `h-[45dvh] lg:h-[100dvh]` / `h-[100dvh]` pane heights with `h-full min-h-0` inside a `grid-rows` split so the pane fills its share of the row on any viewport; keep the off-screen (not unmounted) trick for the board-only view so the session never restarts.

**Untouched:** `questionVideo.ts` section maths, `questionVideoStore.ts`, upload/storage, `QuestionVideoEditor`, board/Smartboard code, `AssessmentBoardPage` and `TeacherExerciseQuestionsPage` wiring beyond what already passes props.

**Verification:** drive the preview with Playwright at 1366×768, 1920×1080, 1920×1200, a ~50% split, and a ~40% narrow panel, plus the full-screen container, asserting the video box keeps its measured ratio, stays centred, and that `document.documentElement.scrollWidth` never exceeds the viewport width.
