# Floating Numbers: five tiles at a time, keyboard-key look

A targeted update to the existing Floating Numbers strip. The Smartboard and the Game already share one strip, and it already holds five numbers. This update changes how the tiles look, how scrolling works at the ends of the list, and adds swiping. It does not add a second number engine.

## What changes

1. **At most five tiles showing.** When more than five numbers are available, the left and right arrows move through the rest one step at a time. When fewer than five are available, only those tiles show, with no empty placeholders.
2. **Scrolling stops at the ends.** Right now the arrows wrap around without stopping. After this update, the left arrow is greyed out at the start of the list and the right arrow is greyed out at the end. Used numbers that you reveal with the left arrow still work as they do today.
3. **Smartboard tiles (compact).** Small keyboard-key cubes about 28 px, with a light face, thin border, shallow bottom edge and 4 px gaps. The number text stays its current size. Only extra padding is removed. The tiles have these states:
   - Normal
   - Selected (blue ring)
   - Pressed (pushed in)
   - Used (greyed)
   - Operator (light green tint)
4. **Game tiles (premium).** The same five-at-a-time strip, drawn as raised cream tiles about 40 px with a gold frame and a blue glow when selected, as in your reference picture. This style applies only when the strip is inside a Game.
5. **Swipe on touch screens.** A short sideways swipe across the strip does the same as the left or right arrow. A tap still picks a number, and a swipe never picks one. Tapping a number never scrolls the strip by mistake.
