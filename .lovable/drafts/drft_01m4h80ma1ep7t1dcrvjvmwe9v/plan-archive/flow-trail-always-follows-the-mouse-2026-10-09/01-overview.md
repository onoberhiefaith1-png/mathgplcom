# Flow trail always follows the mouse

## The cause
The glowing Flow trail picks its position in this order: first the Smartboard's writing sensor, and only if there is no sensor, the mouse. Outside a Solution there is no sensor on screen, so it follows the mouse. Inside a Solution the sensor appears, so the trail sticks to it. That's the bug.

## The fix
- The trail always follows the mouse (or finger), including inside a Solution.
- Before the mouse has moved for the first time, the trail starts at the sensor so it doesn't pop up in a corner. After the first movement it only follows the mouse.
- Nothing else changes: the writing sensor, typing, Floating Numbers, the Flow character and trail settings (length, fade, "only with #" / "always") all work as they do now.

## Check
Open a Smartboard with Flow, press #, go into a Solution, and move the mouse. The trail should follow the pointer and not the sensor. Then do the same outside a Solution.

## Technical details
- `src/components/flow/FlowOverlay.tsx`, `getPoint`: return `pointer.current` when it is set, and fall back to the `.sb-sensor` rectangle only when it is still null.
- `FlowSetupPage` preview keeps its own contained `getPoint`, so it isn't affected.
