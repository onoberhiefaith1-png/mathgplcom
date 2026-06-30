## Plan: Restore the draggable floating number display

1. **Make the left rectangular grip the real drag handle**
   - The vertical rectangular block beside the floating numbers will start the drag directly.
   - Dragging it up/down will move the whole floating-number display, exactly like the screenshot reference.

2. **Keep floating-number chips clickable**
   - Tapping chips, arrows, and notebook icon will continue to work normally.
   - Drag behavior will not steal normal chip clicks.

3. **Respect the existing movement boundary**
   - The top limit remains below the completed math structure with the required clearance.
   - The bottom limit remains inside the active working area / before the next section.
   - If the current position becomes invalid, the display will clamp back into the nearest valid position.

4. **Fix the commit bug after dragging**
   - Ensure the final dragged Y-position is saved using the latest position, not a stale React state value.
   - This prevents the panel from snapping back after release.

5. **Verify in the smartboard preview**
   - Open the current smartboard route.
   - Drag the left rectangular grip upward and downward.
   - Confirm the whole floating-number display moves and stays within bounds while chips remain clickable.