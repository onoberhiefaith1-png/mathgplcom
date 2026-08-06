# Add Reset Button to Floating Numbers Page

## Goal
Place a **Reset** button in the top bar of the Floating Numbers preparation page. When clicked, it removes every generated floating number (chips / containers) so the teacher can rebuild them manually.

## Changes

1. **Top bar button** (`src/pages/FloatingNumbersPage.tsx`)
   - Add a `Reset` button next to Generate / Save / Shuffle.
   - Use a destructive-but-muted style (e.g. outline button with `RotateCcw` icon).
   - Disable when there are no floating numbers to clear.

2. **Reset handler**
   - Iterate `lines` and reset each line to:
     - `fillers: []`
     - `containers: []`
     - `arrangement: []`
     - `fillersSelected: []`
     - `containersSelected: []`
   - Preserve `equation`, `marks`, `table`, and line identity.
   - Set `dirtyRef.current = true` so autosave persists the cleared state.
   - Show a toast confirming the reset.

3. **No persistence model changes**
   - The existing `floating_lines` / `floating_bucket` save path is reused; reset simply writes empty chip arrays through the normal autosave/manual save flow.
