# Restore the original Flow character controls

Replace the new drag/slider bar with the **existing original Flow controls**: the move icon, −, percentage readout and +. Reuse their actual movement and resizing behavior rather than recreate a similar-looking control.

- **Free movement:** drag horizontally, vertically or diagonally anywhere in the Flow preview. Remove the new obstacle-snapping behavior that relocates the character around buttons instead of following the pointer.
- **Much larger sizing:** restore the original Flow scale range of **0.3–10×**, including its −/+ increments. Remove the new 2.5× cap, footer restriction and automatic shrinking that prevent the selected size from appearing.
- **Saved placement:** keep the chosen proportional position and size after Save/reopen and across tablet, phone and desktop. Do not silently reset, snap or shrink the saved choice.
- **Editor only:** original placement controls appear in this Game’s Flow editing preview, not actual play. In play the character cannot be moved or resized.
- **Keep actions usable:** render action and emotion controls above the character when their areas overlap, rather than moving or shrinking the character behind the creator’s back.

## Confirmed findings
The original Flow already uses `DraggableResizable`, with a move icon, −/+ buttons, a 0.3–10× range and two-axis movement. It also supports coordinates relative to a preview frame. The new Game implementation instead uses a separate bar, a 2.5× cap and a placement helper that snaps around action rectangles and repeatedly shrinks the character when space is limited. These restrictions will be removed from Game character placement.