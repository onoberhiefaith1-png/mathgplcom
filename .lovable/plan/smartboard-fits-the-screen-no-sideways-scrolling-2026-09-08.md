# Smartboard fits the screen — no sideways scrolling

Goal: on a phone, tablet or laptop, the whole question and its working sit inside the screen width. Long lines continue on the next line, the page only scrolls up and down, and the side arrows in the middle of the screen are gone. Every control (Undo, Redo, Back, Next, Eraser, Floating Number, keypad) stays available. Desktop teaching view keeps its current look.

## What is causing it

- Student and guest boards are deliberately forced to a fixed wide board (1100px on phones, 1280px on tablets) and the board area is set to scroll sideways. That guarantees content off-screen on a phone.
- Because sideways scrolling exists, two floating arrow buttons are drawn on the left and right edges to shove the view across. Those are the arrows in the screenshot; they also sit on top of the question.
- The writing area keeps a fixed 80px left margin plus a 32px right gap at every screen size, so a phone loses about a third of its usable width before any maths is drawn.
- Lesson text wraps, but a single long maths run (for example the whole quadratic formula written as one expression) is rendered as one unbreakable piece, so it pokes past the right edge even with wrapping on.

## What changes

1. Remove the forced wide board for phones and tablets. The board becomes exactly as wide as the space available, never wider.
2. Turn off sideways scrolling on the board on every device; up-and-down scrolling stays. Two-finger pan is no longer needed, so it is removed for the touch board.
3. Delete the two floating left/right arrows in the middle of the screen. The Back/Next section arrows next to Undo/Redo stay exactly where they are.
4. Make the left margin and right gap of the writing area proportional on small screens (a small margin on phones, unchanged on desktop), so text starts near the edge and uses the full width.
5. Allow long maths to break onto the next line: maths runs inside lesson text become wrappable at natural break points (operators, equals signs, spaces) instead of one unbreakable block, and each fraction/root stays intact as a unit. Text size is untouched, so nothing becomes unreadably small.
6. As a final guarantee, any single object that is still wider than the screen (a wide table, chart or diagram) is scaled down to fit its own row instead of forcing the whole page sideways.
7. Same behaviour on every guest/shared entry point, because they all render the same board: guest link boards, exercise and assignment cards, adventures, smart cards, audience/live boards.

## Technical notes

- `src/hooks/useMobileStudentBoard.ts`: drop `MOBILE_BOARD_MIN_WIDTH` / `TABLET_BOARD_MIN_WIDTH` from the returned mode (keep exports if imported elsewhere, defaulted to 0) so no consumer can force a minimum board width.
- `src/components/smartboard/PresentationView.tsx`:
  - board `<main>`: always `overflow-x-hidden`, `min-w-0`, `touchAction: pan-y` (or `none` while erasing); remove the two-finger pan handlers tied to horizontal scroll.
  - `WritingSurface` style: remove the `minWidth: mobileBoard.boardWidth * zoom` branch; add `maxWidth: "100%"`.
  - remove the `mobileStudent && ([-1,1]).map(...)` edge pan-arrow block (~line 6855) and any now-unused imports.
  - beat wrapper: `maxWidth: "100%"` alongside the existing `64rem`; `paddingRight` scales down on touch layouts.
- `src/lib/smartboard/grid.ts`: `getGrid` takes an optional compact flag (or margin scale) so `MARGIN_LEFT` shrinks on narrow viewports; callers in `PresentationView` pass it from `useIsTouchLayout`/measured width. All row maths already derives from the grid, so caret/baseline alignment follows automatically.
- `src/components/smartboard/SmartboardLessonText.tsx` + `src/lib/notebook/mathRender.tsx`: wrap math runs in a container that permits line breaks (`display: inline`, `white-space: normal`, break opportunities after top-level operators) while keeping structural atoms (`frac`, `root`, `sup`/`sub` groups) non-breaking via their existing `nowrap`.
- Verification: Playwright at 390x844 (phone portrait), 844x390 (landscape), 834x1112 (tablet) and 1440x900, asserting `scrollWidth <= clientWidth` on the board scroller and on `document.documentElement`, no element wider than the viewport, and that Undo/Redo/Back/Next/Eraser/Floating Number remain visible and hittable. Screenshots at 1280x1800 for the record. Plus `bunx tsgo --noEmit` and the smartboard test files.

## Out of scope

No change to lesson content, maths correctness, the floating-number workspace behaviour, the foldable top bar layout, desktop teaching visuals, or any backend.
