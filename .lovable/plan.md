# Smartboard: remove five tools, and a phone/tablet layout for the floating numbers

## What changes

1. Five buttons disappear on every device (laptop, tablet, phone), with nothing put in their place.
2. On phones and tablets only, the floating-number workspace stretches across the full width at the bottom of the screen, and the eraser and `#` buttons sit just above it instead of beside it.
3. Laptop/desktop keeps its current arrangement, apart from the five removed buttons.

## The five buttons being removed

| Icon | What it currently is | Where it lives |
| --- | --- | --- |
| F | "Structures" opener (bottom-right) | `AssistantButtons.tsx` |
| Σ | "Symbols" opener (right edge, middle) | `AssistantButtons.tsx` |
| Eye/camera | AI line-verification toggle (right edge, below middle) | `PresentationView.tsx` |
| − | Drop-a-line tool (right rail) | `PresentationView.tsx` |
| □ | Box tool (right rail) | `PresentationView.tsx` |

Buttons, their tooltips, their click handlers and the empty space reserved for them go away. The round dot button between − and □ on the right rail stays, so the rail remains with one control.

Two consequences worth stating plainly, because they follow from removing these buttons and nothing else:

- The Structures and Symbols trays no longer have an opener, so they will not appear. Their code stays in place, unused, so they can be brought back later.
- The AI line-verification lights can no longer be switched on from the board; verification stays off unless it is turned on from somewhere else later.

Everything else — floating numbers, eraser, `#`, undo/redo, section arrows, the sensor pad, writing behaviour, maths and lesson-note logic — is untouched.

## Phone/tablet layout

Applies when the screen is phone or tablet sized (the existing `useBreakpoint` hook), for teachers and students alike, and re-measures on rotation and resize.

- The floating-number workspace becomes a full-width bar pinned to the bottom, respecting screen edges and safe-area insets, instead of the narrow left-offset box.
- The eraser and `#` buttons are lifted so they float directly above that bar, side by side, with comfortable tap size and spacing.
- Their vertical position is measured from the workspace's real rendered box, not a fixed number, so a tall/wide design pushes them higher and a short design lets them settle lower, always with the same small gap and never overlapping.
- The writing/solution area keeps everything above that group and is never covered by controls.

Desktop keeps the eraser and `#` exactly where they are today.

## Technical notes

- `AssistantButtons.tsx`: drop the Structures and Symbols buttons and their icon imports; keep the `numbers` (`#`) button. Add an optional absolute-position override so the parent can place it above the measured panel on touch layouts, keeping the current `left/bottom` on desktop.
- `PresentationView.tsx`: delete the `ScanEye` verification button, the `MinusIcon` drop-line button and the `SquareIcon` box button (plus now-unused icon imports); leave `spawnSmartLine`/`armBox` logic in place. Add a touch-layout branch that reads the floating panel's bounding box (`ResizeObserver` on the panel element, already portalled into the smartboard root) and uses `panelRect.top - gap` for both the eraser home position and the `#` button.
- `FloatingNumberPanel.tsx`: on touch layouts replace `fixedLeft`/`maxWidth` with `left: safeInset`, `right: safeInset`, full-width flex, and `bottom: max(8, viewportBottomInset) + env(safe-area-inset-bottom)`; desktop values unchanged. Expose the panel element via a ref/callback so the parent can measure it.
- No changes to data, server functions, or the Floating Number/solution logic.

## Checks

Typecheck, existing smartboard tests, then Playwright screenshots at desktop, 390x844 phone, portrait and landscape tablet: five icons gone, full-width workspace, eraser and `#` above it with no overlap and no horizontal overflow, both with a wide and a narrow floating design.
