# Make Game scrolling as flexible as Edit mode

## Goal
Treat the Game board as one continuous vertical page made from separate writing surfaces. The player can move it freely up or down from anywhere on the board, including pulling writing surface 0 down into the middle of the screen, without elastic snap-back.

## Confirmed cause
- Game and Edit share the same board, wheel, drag, and surface layout code.
- Game additionally follows the active Floating Numbers line. Its focus effect depends on the continuously recalculated surface layout, so text measurement, wrapping, or surface growth can re-centre the active line after a manual drag. This creates the reported spring-back; Edit mode does not pass that active-line focus.
- The shared scroll range is currently clamped from `0` to the last surface. Because there is no space above `0`, the first writing surface cannot be pulled down into the viewport.

## Changes
1. **Add genuine top travel**
   - Give the continuous board a negative upper scroll allowance large enough to place writing surface 0 around the middle of the viewport.
   - Preserve the existing lower travel so later surfaces can continue downward and remain reachable.
   - Use one shared min/max range for wheel, pointer drag, scrollbar, surface markers, and programmatic line focus.

2. **Stop Game from undoing manual movement**
   - Separate a deliberate active-line change from incidental text measurement or surface growth.
   - Re-centre only when the player actually changes the active line or uses a surface marker—not whenever layout recalculates.
   - After a manual wheel or drag gesture, leave the board exactly where the player places it.

3. **Keep controls accessible while moving**
   - Continue capturing wheel input over writing surfaces without requiring a click first.
   - Keep drag scrolling available over the board while preserving actual buttons and the content-margin handle.
   - Update the right-side scrollbar and its line markers to represent the extended top-to-bottom range correctly.

4. **Protect dynamic writing behavior**
   - When text wraps or a writing surface grows, retain the reader’s current visual position rather than jumping to another line.
   - Keep independent surface spacing and the existing content-margin editing behavior unchanged.

## Verification
- Add movement tests covering signed top travel, full bottom travel, scrollbar mapping, and clamping.
- Add a regression test proving a layout/height update cannot overwrite a manual Game scroll position.
- In the running Game, verify with the current question:
  1. drag writing surface 0 down near the middle and release;
  2. confirm it stays there without springing back;
  3. wheel/trackpad scroll from blank room space and directly over a writing surface;
  4. move freely from the first surface to the final surface and back;
  5. use the right scrollbar in the same direction as the movement;
  6. confirm the content-margin handle remains visible and movable after repositioning;
  7. confirm wrapped/added text does not force the board back to the active line.

## Scope
This changes only Game board navigation and positioning. It does not change Floating Numbers, evaluation, rewards, writing-surface appearance, spacing, or question content.
