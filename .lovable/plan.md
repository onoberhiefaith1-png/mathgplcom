## Plan: Fix Floating Number Logic Only

### Scope
Keep the current Floating Number interface exactly as it is. No layout, color, icon, spacing, or styling changes.

### 1. Make the strip a true circular conveyor
Update only the movement/state logic in `FloatingNumberPanel.tsx` so the flow is:

```text
visible five slots -> blue Used section -> hidden right queue -> visible five slots
```

Behavior to enforce:
- The visible five slots are a fixed window, not a normal filtered scrolling list.
- When a teacher taps a white chip, that exact chip first becomes Used/blue.
- The next hidden chip enters from the right.
- A chip must not reappear as white until it has passed through the Used section.
- When all hidden/unused chips are exhausted, the oldest Used chip cycles back from the far right as white.
- The five-slot display never becomes empty; single-chip sets repeat correctly.

Technical direction:
- Replace the current `remaining`-only window fill with an explicit ring/queue model derived from `allSlots` and `consumedAbsIdx`.
- Keep Used ordering for display, but use an oldest-used return queue for re-entry from the hidden right side.
- Remove the parent logic that clears all consumed chips as soon as a line is fully used, because that makes chips reappear without correctly passing through Used.

### 2. Preserve highlighted chips exactly
Fix the data path so the Smartboard presentation displays the same chip text saved from Floating Number Selection/Editing.

Behavior to enforce:
- `=0` stays `=0`, never `=` or `0`.
- `a = 5` stays `a = 5`, never `a =`.
- `+5x` stays `+5x`.
- No splitting, sign stripping, spacing changes, reconstruction, or AI reinterpretation for teacher-highlighted/edited chips.

Technical direction:
- Stop using term extraction/render-label logic for presentation chip labels when a saved teacher chip already exists.
- Keep math-display safety/rendering, but feed it the saved token verbatim.
- Remove remaining contextual plus dropping in the persisted bucket compiler for teacher-edited lines.
- Ensure `buildReservoirs` prefers per-line saved fillers in teacher arrangement exactly as saved.

### 3. Restore chips when deleted from the whiteboard
Add a synchronization pass in `PresentationView.tsx` that compares currently used floating chips with what still exists on the board.

Behavior to enforce:
- If the teacher inserts `+5x`, it becomes blue Used.
- If the teacher later deletes that `+5x` from the whiteboard with Backspace or eraser, it is removed from Used.
- It returns to its original unused position in the circular strip as a white chip.
- Used always means “currently present on the whiteboard,” not “was tapped once sometime earlier.”

Technical direction:
- Track each used floating chip by absolute fragment index and exact saved label.
- After board edits (`freeLines`) change, recompute which consumed chips still appear on the active guided board line.
- Remove consumed indices whose exact chip is no longer represented on the board.
- Use a conservative normalizer only for comparing visual math-tree text to saved chips; do not change the saved chip itself.

### Verification
- Use the example `2x², +5x, =0, +3, -7x, +2x`.
- Confirm tapping `+5x` moves it to Used first and does not immediately reappear as white.
- Confirm `=0` displays exactly as `=0` in presentation.
- Confirm deleting a used chip from the board removes it from Used and restores it as white in its original ring position.
- Confirm the UI looks unchanged.