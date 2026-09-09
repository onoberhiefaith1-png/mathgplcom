# Smartboard on phone & tablet — fixed shell, question screen, honest fullscreen, correct tab colours

Touch devices only. The laptop/desktop board stays exactly as it is.

## 1. Ask Teacher moves off the board

- The "Ask a Question" panel is removed from the board surface on phones and tablets.
- A short **question screen** now appears first, before the board opens: the question text, the marks, and an **Ask your teacher a question** panel (the existing one, reused unchanged), then a single **Open Smartboard** button.
- It appears each time a student opens a question on a phone or tablet; going back from the board returns to it, so a student can ask at any point without giving up board space.
- On laptop nothing changes: the board keeps its own Ask panel.

## 2. The board frame stops moving

- The board becomes a fixed workspace: the top bar and the bottom toolbar are pinned to the screen and can never be pushed out of view.
- Only the maths area between them scrolls and zooms. Dragging or zooming the working area leaves question numbers, score, timer, zoom and the bottom tools exactly where they are.
- The page behind the board no longer scrolls, so there is no way to lose the bar and have to scroll back for it.

## 3. Fullscreen only where it truly works

- The board checks whether the browser really grants fullscreen before offering it.
- Where it does, fullscreen uses the whole usable screen and no control sits under browser chrome.
- Where it does not (most iPhone browsers), the Expand button is simply not shown, and the board instead fills the real usable height. No fake fullscreen.

## 4. Question tab colours 1 / 2 / 3

- Restore the intended two states on the tabs: **blue** for a question whose mark is already earned, **brown/gold** while a timed attempt is in progress on it. A question with nothing to solve stays neutral.
- Score and timer readings become purely informational: having a score never forces a tab to blue, and the brown state only reflects the live timed attempt.
- The current question keeps its outlined highlight on top of whichever colour applies.

## 5. Nothing overlaps, at any width

- The top bar lays out so question tabs, score, timer, zoom and the remaining controls never touch each other, from a narrow phone up through tablet.
- Space is found by dropping non-essential items (as already done with the zoom percentage when a timer runs), not by shrinking text.
- Checked at narrow phone, iPhone portrait, tablet and laptop widths.

## Technical notes

- `src/components/notifications/AskQuestionButton.tsx` / `AskAssessmentQuestion` render gated behind `!touchLayout` in `PresentationView`.
- New touch pre-board step in `src/pages/student/AssessmentBoardPage.tsx` (and the guest/smart-card board hosts `GuestBoard.tsx`, `SmartCardChallengePage.tsx`) rendering the question + `AskAssessmentQuestion`, with local state gating the board mount.
- Fixed shell: root board container gets `position: fixed`-style full-viewport sizing on touch with `100dvh`; chrome rows keep `data-board-chrome` absolute placement while `<main ref=boardScrollRef>` remains the only scroll container; host wrapper `overflow-hidden` retained and `overscroll-contain` kept on the canvas.
- Fullscreen capability probe: `document.fullscreenEnabled` plus an element-level `requestFullscreen`/`webkitRequestFullscreen` presence check, computed once, exposed as a `canFullscreen` flag; Expand renders only when true. `useMobileStudentBoard`/`FullscreenToggle` remain unchanged for desktop.
- Tab colour logic in the assessment chrome block: keep `lineCarriesMarkState` neutral gate, derive `blue` from `progressLayers.blue`/`solvedSlots` only and `brown` from `timer.active` + confirmed layers; remove any dependence on score totals.
- Verify with `bunx tsgo --noEmit`, the focused touch UI tests, and Playwright runs at 390x844, 360x780, 820x1180 and 1280x900.
