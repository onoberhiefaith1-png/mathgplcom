# One Master Sensor: free positioning + full text editing

## What is happening today

The lesson note has two separate input systems:

- **Free sensor (the "big" one)** — when you double-click empty space, a glowing marker is parked at that coordinate and a hidden one-character input takes over the keyboard. That hidden input only listens for "first keystroke" or Enter: it has no text content, so Backspace, arrow keys, selection and editing simply do nothing until content is materialised.
- **Document caret (the "small/old" one)** — the real editor caret. It has proper typing, Backspace, arrow movement and editing, but it can only live inside the flowing note body, so it is unavailable in blank space, beside or under a diagram, or in the extended area.

Because the free sensor stands in front of the real caret, the two never share one editing state.

## The change

Keep one sensor with one editing state — the real editor caret — and give it the free sensor's positioning freedom.

1. **Delete the hidden keyboard input entirely.** No second keyboard owner, no second editing model.
2. **Free placement materialises immediately.** Double-clicking (or clicking) blank space creates a real, empty, free-positioned frame at that exact coordinate and drops the actual editor caret inside it. From the first moment you can type, Backspace, select, move with arrows, press Enter for new lines — everything the old caret could do, because it *is* the old caret.
3. **Self-cleaning empty frames.** If you place the sensor somewhere and then move it elsewhere or click away without typing anything, the empty frame is removed, so stray blocks (like the leftover "X") never accumulate.
4. **One marker, one visual.** The sensor marker keeps tracking the single caret position — free-positioned or in the flow — and stays visible when focus moves to the ribbon so you can still see where the next insertion will land.
5. **Insertions unchanged in behaviour, simpler underneath.** Section / Add Session / Add Subtopic still insert exactly at the sensor: inside the free frame when the sensor sits in open space, in the flow when it sits in the note body. Diagrams, graphs and canvas objects remain independent and are never captured by the sensor.

## Freedom preserved

The sensor can still be parked above a diagram, beside a diagram, in empty space, below a section, between two objects, in the Note Extend area, or at the far right of the sheet — and in every one of those places it now behaves as a full text editor.

## Technical notes

- In `src/components/lessonnotes/DocumentEditor.tsx`: remove the `data-sensor-input` hidden input, `sensorInputRef` and `materialiseSensorFrame`'s "first keystroke" path.
- `placeSensorAtPoint`'s free branch will insert a `canvasFrame` node (existing `src/components/lessonnotes/extensions/CanvasFrame.tsx`) with the clicked paper-local `x`/`y`/`w`, then `setTextSelection` inside its paragraph and focus the editor. `freeSensor` state becomes derived tracking (which frame is active + its coordinates) rather than a separate input mode.
- `insertAtSensor` collapses to a single flow-based path, because a free sensor is already a real caret inside a frame; it keeps the "insert after the containing block" rule.
- Track the last-created empty frame; on caret move to another block, blur, or Escape, drop it if its text content is empty.
- `SensorCaret` renders from the caret position only (free-coordinate branch no longer needed); it stays mounted when the editor loses focus.
- Gutter dragging of free frames, geometry tools, canvas boxes and the localStorage remembered position keep working as they do now.
