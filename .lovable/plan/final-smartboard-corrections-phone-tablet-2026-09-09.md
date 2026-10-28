# Final Smartboard corrections (phone/tablet)

Only the five items below change. The solving engine, marking, scoring, timer persistence and desktop layout stay as they are.

## 1. One single top row

Today the phone board draws the question numbers and a second progress strip of line dots, which stacks into a second layer. Collapse everything into one row, in this order:

```text
←  |  1 2 3  |  9/45  |  timer  |  100%  |  reset  |  settings  |  expand
```

- Back returns to exactly where the student came from (assignment, course, or previous page) — the existing back target is kept.
- Only three question numbers show at a time, current one centred whenever a previous and next exist, sliding at the ends. Completed numbers keep their completed colour.
- Score stays visible and never drops on Reset.
- Timer only occupies space when the teacher enabled it; tapping the best time reveals the overall best.
- Percentage stays compact.
- Reset clears the working area only, never awarded marks.
- Settings unchanged.
- The separate line-dot strip is deleted; its state moves onto the three-number row.

## 2. One number line, blue / green / purple

The two stacked progress rows become one sequence with two colour layers:

- No timer: every completed line is blue, no green, no tick symbol.
- Timer enabled: permanent completion stays blue, the current timed attempt paints green on top, and a line that has both reads purple.
- Reset removes only the green layer; blue survives.
- Green never renders as its own separate row.

## 3. Expand actually goes full screen

Expand requests real device full screen on the board container and drops the browser chrome where the platform allows; pressing it again returns to the normal view. Icon reflects the live state.

## 4. L1 / L2 / L3 labels

The line label under the floating-number dock is being clipped at the bottom edge. Lift that row a few pixels (and give it its own clear height plus safe-area allowance) so the full label reads. No behaviour change.

## 5. Navigation arrows become solid triangles

The four movement controls keep their place and behaviour; their thin chevrons are replaced with filled, shaded triangles (up, down, left, right).

## 6. Note appears once

A note is currently rendered twice for one activation. Make note writing idempotent per line and attempt: automatic activation and manual tap both produce exactly one rendered note. If the student closes it and taps again, it may reappear — but one activation never yields two copies.

## Technical notes

- `src/components/smartboard/PresentationView.tsx`: merge the `mobileStudent` chrome row — remove the separate `hasGuidedLines` dot strip, render one combined sequence whose colour derives from `solvedSlots` (blue) and `timer.confirmed` (green, purple when both); keep `getQuestionWindow` for the three-slot window; keep `toggleTouchFullscreen` but ensure the icon and immersive flag follow `document.fullscreenElement`.
- Note duplication: `activateNoteOnce` calls `writeNoteForLine`, and `FloatingNumberPanel`'s `onWriteNotebookToBoard` can fire for the same line — guard both through one write path that checks for an existing note row for that line before writing.
- `src/components/smartboard/FloatingNumberPanel.tsx`: raise the `L{n}` label row and reserve its height.
- `src/components/smartboard/SensorDPad.tsx`: swap `Chevron*` icons for filled triangle glyphs.
- Tests: extend the touch-UI test file for window/colour-state combination and single-note activation.
