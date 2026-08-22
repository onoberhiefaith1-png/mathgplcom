# Permanent arrow cursor and click-recovery plan

## Confirmed current behavior
- The lesson-note and Smartboard code still explicitly requests hand/grab cursors in several places, including the draggable Sensor controller and lesson controls.
- The existing reset system clears only inline/global cursor overrides. It does **not** prevent component CSS or inline styles from immediately showing a hand again.
- The preview is currently in the normal arrow state, so the intermittent click blocker is not active at this moment; its exact source must be captured when it recurs rather than guessed.

## Changes
1. **Enforce an arrow-only application cursor**
   - Add one global, highest-priority cursor rule for the application root and all descendants, including pseudo-elements.
   - Remove the Sensor controller’s explicit `pointer`, `grab`, and `not-allowed` cursor assignments so its arrows and centre drag control remain functional but always display the normal arrow.
   - Stop 3D hover handlers from requesting a hand cursor; hover/click behavior remains unchanged.

2. **Make pointer cleanup reliable**
   - Strengthen the shared interaction reset so pointer capture and drag state are released on pointer-up, pointer-cancel, blur, visibility changes, route changes, and component teardown.
   - Register lesson-note object drags and the draggable Sensor controller with that cleanup path so an interrupted drag cannot leave a click-blocking state behind.

3. **Detect the real blocker without exposing errors**
   - When a pointer action does not complete, record the topmost element, active overlay, pointer capture, and drag state in internal stability diagnostics.
   - Automatically remove only stale temporary interaction layers/captures; do not refresh the page or discard lesson work.

4. **Verify without refreshing**
   - Test Lesson Notes and the Test Smartboard across ordinary buttons, editor content, Sensor arrows, Sensor dragging, dialogs, route changes, tab switching, and simulated cancelled drags.
   - Confirm the cursor remains an arrow throughout and that controls remain clickable after every interruption/recovery scenario.

## Scope
This changes cursor appearance and interaction cleanup only. It does not redesign controls or alter lesson, Smartboard, evaluation, or note behavior.
