# Smartboard mobile/tablet layout and question flow

## Goal
Give students the largest possible solving canvas on phones and tablets while preserving the current laptop/desktop layout. Remove the visible manual **Check / Check Line** control on every device, but keep the existing automatic marking, scoring, and mathematical engine intact.

## Confirmed current structure
- Guest links currently render an outer session header in `GuestBoard` and a second assessment control panel inside the shared `PresentationView`; this creates the duplicated top area shown in the screenshot.
- The inner assessment panel currently renders every question number, score, line-progress rows, timer details, zoom controls, reset, and settings.
- Undo, Redo, Previous section, and Next section are currently a vertical left rail; Eraser and `#` are separate floating controls; the four-direction pad already supports dragging but defaults near the bottom centre.
- Floating Numbers already report their rendered size, so controls can move above the real panel rather than relying on a guessed fixed offset.
- Guest assignments/courses, assessment boards, Smart Cards, audience challenges, and student boards share `PresentationView`, so the touch layout can be made consistent without changing the solving engine.

## Implementation

### 1. One compact touch header
- On phones and tablets, replace the outer guest header plus inner assessment panel with one shared compact header.
- Header order: **Back | three question positions | Score | Zoom % | Reset | Video | Settings | Fullscreen**.
- Remove the lesson title, duplicate Back button, long question-number row, line-progress rows, timer-statistics row, and second panel background from the touch layout.
- Keep laptop/desktop layout and controls in their existing positions, apart from the Check removal requested below.
- Pass guest-owned actions/state (question selection, score, video availability/view, Back, fullscreen) into the shared board header instead of layering another header above it.

### 2. Exact three-number question window
- Add one reusable three-position question-window calculation used by guest and signed-in assessment boards.
- For question index `i`, show a clamped window beginning at `i - 1`: `1|2|3` for Questions 1 and 2, `2|3|4` for Question 3, `3|4|5` for Question 4, and the final three valid numbers at the end.
- Highlight the active question; every visible number is directly selectable.
- Never render a number below 1 or above the actual total, including activities with only one or two questions.
- Keep Back/Next question movement wired to the same authoritative question state so the header, question content, and score cannot drift apart.

### 3. Maximum solving area on touch devices
- Build the phone/tablet board as a `100dvh` grid with measured/intrinsic compact header and bottom strip, and the solving canvas as the remaining `minmax(0, 1fr)` region.
- Treat 90%+ solving space as the target while preserving usable touch targets; avoid hard-coded major-region heights that consume a disproportionate share on small phones.
- Recalculate after rotation, resize, browser-bar changes, and fullscreen changes.
- Keep horizontal overflow disabled and preserve the existing text/math wrapping so questions continue vertically.
- Ensure removed panels leave no hidden height, margin, or padding behind.

### 4. Touch-only movable navigation pad
- Keep the existing four-direction sensor controls and all movement behavior.
- On phones/tablets, default the pad to the middle-right of the solving canvas rather than the bottom centre.
- Keep it draggable in both directions and clamp its saved position inside the visible solving canvas after resize/orientation changes, clear of the compact header and bottom workspace.
- Leave the desktop pad placement unchanged.

### 5. Compact six-control bottom strip
- On phones/tablets, consolidate **Eraser | # | Undo | Redo | Back | Next** into one compact horizontal strip with icon buttons and accessible labels.
- Remove the duplicate touch left rail and separate Eraser/`#` placement only after their actions are wired into this strip.
- Preserve all existing undo/redo and previous/next rules, including disabled states and lesson gates.
- Leave desktop control placement unchanged.

### 6. Floating Numbers hidden by default and measured when open
- Keep Floating Numbers closed on initial board load.
- When `#` opens them, render the workspace upward from the bottom and move the six-control strip immediately above its measured bounding box.
- When closed, return the strip to the bottom safe area and release the reclaimed space to the canvas.
- Use `ResizeObserver`/actual rendered bounds for every Floating Number style and orientation; never overlap or reserve an empty panel.

### 7. Fullscreen and video behavior
- Put the existing video/explanation action in the compact touch header only when video exists; do not duplicate video content or create a new player.
- Add the board fullscreen action to that same header. Use the browser fullscreen API where supported and retain the existing immersive fallback where device browsers do not support element fullscreen.
- Re-measure the layout immediately after entering or leaving fullscreen.
- Keep the current desktop fullscreen behavior unchanged.

### 8. Remove Check Line everywhere
- Remove the visible Check button/menu, its dropdown, Check Line labels, and the result overlay from phone, tablet, and desktop Smartboards.
- Remove the layout offsets and state used only by that manual interface.
- Preserve silent/automatic grading, score updates, completed-line tracking, realtime progress, timer completion, and server-side mathematical validation so removing the button does not weaken assessment behavior.

## Verification
- Test small phone portrait, large phone portrait, phone landscape, tablet, and laptop/desktop.
- Verify there is exactly one touch header, no title/duplicate Back/second panel, and no horizontal overflow.
- Verify question windows at Questions 1, 2, 3, 4, penultimate, and final, including 1-question and 2-question activities.
- Verify Eraser, `#`, Undo, Redo, Back, Next, Settings, Video, Reset, and Fullscreen still invoke their existing actions.
- Open and close every Floating Number display style and confirm the strip follows its measured height without overlap.
- Drag the navigation pad, rotate/resize, and confirm it remains reachable inside the solving canvas.
- Confirm Check/Check Line is absent on touch and desktop while automatic marking and scores still update.
- Run the shared Smartboard tests and browser-check both a guest link and a signed-in student assessment; confirm desktop layout is otherwise unchanged.
