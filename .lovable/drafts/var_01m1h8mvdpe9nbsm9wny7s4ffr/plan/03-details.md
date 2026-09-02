## What changes on the board

Three places on the board can currently pop the native keyboard on a touch device:

1. **The invisible keyboard capture** behind the board. It is auto-focused on load, which is what actually summons the keyboard. Today it is only muted for mobile students.
2. **Text boxes on the board** (the draggable answer/label boxes). They are directly editable, so tapping one opens the keyboard.
3. **Free-write / writing-lab text entry** and the small on-board text fields.

On phone or tablet inside the board, all three stop raising the keyboard. Boxes stay fully usable: tapping a box still selects it, and the board's existing number, symbol and fraction keys write into the selected box exactly as they already do (that path already exists). Dragging, resizing, erasing, panning, zooming and every control keep working.

Settings sheets and dialogs launched from the board keep their normal keyboard — they are ordinary forms, not the mathematical workspace.

## Technical notes

- New shared hook `useBoardNativeKeyboard()` in `src/hooks/` built on the existing `useBreakpoint()`: returns `suppress = breakpoint !== "desktop"`. One source of truth, imported only by board surfaces.
- `PresentationView.tsx`: replace the `mobileStudent`-only conditions on the hidden `<textarea>` (`inputMode`, autofocus effect at ~line 824) with the new flag, so teachers and guests on tablets are covered too. `mobileStudent` keeps governing layout/chrome — no layout change.
- `BoxLayer.tsx`: accept a `suppressNativeKeyboard` prop; when set, the inner editor renders with `contentEditable={false}` and `inputMode="none"` while the tap still calls `onActivate(box.id)`. Typed input then flows through the existing active-box writer in `PresentationView` (~line 1511).
- `WritingLab.tsx` / on-board text inputs: `inputMode="none"` + `readOnly` only when the flag is set.
- Assessment Smartboard (`src/pages/student/AssessmentBoardPage.tsx` and the board it renders) inherits the same flag, since it mounts the same board components.
- Nothing global: no document-level listeners, no changes to `src/components/ui/*` inputs, no changes to auth, lesson notes, search or any other page.

## Verification

- Tablet-width and phone-width preview of the Smartboard as teacher and as student: tapping the board, a box and the writing area raises no keyboard; number/symbol keys still write.
- Desktop Smartboard: physical typing, shortcuts and zoom keys unchanged.
- Login and a lesson-note text field on phone width: keyboard still opens.
