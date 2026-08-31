## What stays, what hides

**6. The number line stays — reflowed, not shrunk.**
The assessment strip (Back · 1…13 · marks · timer · zoom) currently sits on one row and overflows on a phone. On phone widths it becomes a stacked panel:

```text
← Back   1 2 3 4 5 6 7
         8 9 10 11 12 13
         0/98 marks   ⏱ 00:41   My Best · Overall
```

Question buttons keep touch-friendly size, the active-question styling and the existing click logic. Marks, timer, best times and the zoom control all stay, compacted. Wrapping is width-driven, so a tablet keeps a single row.

**7. Secondary controls hidden in mobile student sessions only.**
Hidden (functionality untouched, desktop/teacher unchanged): the right-rail authoring tools (drop line “−”, two-point line, box), the Σ symbols / structures assistant buttons, the keyboard-capture affordance, and the big **Check** button. The Floating Numbers panel stays and remains large, draggable and finger-friendly — it is the student's primary input.

**8. Space.**
The board fills the remaining height (`100dvh` minus compact chrome), vertical padding is reduced, no wide empty margins, portrait-first. Tablets follow the same rules with a wider viewport and fewer hidden controls.

## Technical approach

- **Mode flag:** a `useMobileStudentBoard()` helper combining `useBreakpoint()` (`phone`/`tablet`) with `role === "student"`, threaded through `PresentationView` as one derived boolean. Everything reads that flag, so desktop and teacher code paths stay untouched.
- **Viewport/pan:** in `PresentationView`'s board `<main>`, switch `overflow-x-hidden` → `overflow-x-auto` and give `WritingSurface` a `minWidth` (board-width constant × zoom) in mobile student mode. A touch handler starts a pan only when `e.touches.length === 2`, mapping deltas to `scrollLeft`/`scrollTop`; the one-finger pointer flow is left exactly as it is. `touchAction` becomes `pan-y pinch-zoom` so pinch-zoom and vertical scroll survive while single-finger writing still reaches our handlers.
- **Edge arrows:** two small `data-sb-chrome` buttons scrolling the host by ~80% of its client width with `behavior: "smooth"`, rendered only in mobile student mode and hidden at the extremes.
- **Keyboard suppression:** in mobile student mode the capture textarea renders with `inputMode="none"` and the `hiddenInputRef.current?.focus()` calls (sensor-move effect, board pointer-down, insert paths) are skipped behind the flag. Key event handling stays registered for hardware keyboards.
- **Header:** `GuestBoard`'s header gets a phone variant (single compact row, `grid-cols-[minmax(0,1fr)_auto]`, `min-w-0`/`truncate`, `shrink-0` controls) plus an immersive toggle that hides it and shows the floating restore button. The same treatment is applied to the student assessment header (`AssessmentBoardPage`) so both surfaces match.
- **Number line:** the assessment chrome strip gains a mobile layout (stacked rows, wrapped question grid, compacted marks/timer/zoom, reduced `top` when the session header is hidden). Same data, same handlers.
- **Hidden controls:** the right rail, `AssistantButtons`, and the Check dropdown are wrapped in `!mobileStudent && …`.

## Verification

- Playwright at 390×844 (phone) and 820×1180 (tablet) on the guest Quadratic board: screenshot the compact header + wrapped number line, confirm the board scrolls horizontally with full-size maths, tap a question number, tap an edge arrow and confirm `scrollLeft` moved, simulate a two-finger pan, tap the canvas and confirm no focused editable element (no keyboard trigger), toggle full screen and confirm the header disappears and the number line moves up.
- Desktop regression at 1440×900: header, number line, right rail, Σ buttons and Check render exactly as before; zoom and writing unaffected.
- `tsgo --noEmit` plus the existing smartboard tests.

## Out of scope

Desktop/teacher Smartboard, maths engine, zoom engine, marking, question/submission systems, teacher–student sync, and any change to Floating Number behaviour beyond keeping it visible and touch-sized.
