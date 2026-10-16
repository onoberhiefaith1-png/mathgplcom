# Smartboard lesson layout fixes

## What you will see
1. **Same order as the lesson note.** On the Smartboard each question shows, top to bottom:
   Question text → Diagram → "Solution" → the solution's first line (the restated question) → Recall… and the rest.
   Today the diagram is squeezed in beside/under the restated question and the restated line sits on top of the "Solution" label (photos 1 and 3). That will stop.
2. **Breathing space under "Solution".** The gap between "Solution" and the line below it will be the same as the normal gap between two writing rows, so the writing no longer touches the label.
3. **Diagram properties on phones.** Tapping a diagram on a phone opens its Properties directly under the diagram, pushing everything below it down. No side panel on phones. Tablet and desktop keep the right-hand panel.
4. **Full-screen button always there.** It stays visible on every page and every device, and is never hidden behind the Smartboard top bar.
5. **No wrong "upgrade" message.** Creating lesson notes will no longer say your plan doesn't allow it. All accounts are treated as Free, and Free includes lesson notes.

## Technical details
- `PresentationView.tsx` problem beat (~L9343): render the question text, then the question's diagram objects as their own block, then the "Solution" header with row-height spacing (use the board row pitch, not `mt-3`). The solution's restated-question line and the diagram must not share the same flow line; check `FlowingTextAndObjects` placement so a question diagram drawn after the text lands after the text, not inline with the first solution row. Check the initial writing position (~L2658, ~L4132, ~L5935) so the first written row starts one full row below "Solution".
- `ReviewableBoardDiagram.tsx`: the inline Properties block already exists for `phone`; make sure the right-hand Properties panel does not also open on phones, and that the inline block opens on tap (not only when `isActive`), and pushes later content down.
- `FullscreenToggle.tsx`: remove the `useIsTouchLayout` hide; place it so it does not collide with the Smartboard top bar (z-index/offset), and keep it mounted in `__root.tsx`.
- Entitlements: trace why `create_lesson_notes` is refused (`features.ts`, `useUpgradeGuard`, `RequireEntitlement`, server plan check). Make the Free plan include `create_lesson_notes` and accounts with no subscription resolve to Free. First step is confirming the actual cause from your account's data before changing anything.
- Verify with screenshots at phone (428px) and desktop sizes on the right-angle triangle classwork note; add a small test that Free grants `create_lesson_notes`.
