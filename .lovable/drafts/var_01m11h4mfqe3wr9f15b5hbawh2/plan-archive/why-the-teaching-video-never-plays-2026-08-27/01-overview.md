# Why the teaching video never plays

I read the saved video record for the Practice Set A question straight from the database. The video file is fine (255.6 s uploaded, path present), and the frame you see on the black screen is that real file, first frame.

The problem is the saved timestamps. Every mathematical line was stored with the **same start and end**:

```text
intro                 0.00  →  17.63     (ok)
Line 1               40.40  →  40.40     zero length
Line 2               88.70  →  88.70     zero length
Line 3              138.22  → 138.22     zero length
conclusion          204.51  → 255.64     (ok)
```

A zero-length section means the player is already at its end the instant it seeks there, so it pauses immediately — which is exactly what the control bar reports: `Line 2 · 0:00 / 0:00`. Nothing is wrong with the player element itself; it is being told to play a slice of no duration.

Two code faults produced that data:

1. In the section model, when a section has an explicit marker the running "previous end" cursor is not advanced. So the next section's start is computed from a stale value instead of chaining from the boundary above it.
2. In the editor, "Set at playhead" on a section's **End** also pulls that section's **Start** to the same instant when the stale start is bigger, collapsing the range — and nothing warns that the section has no duration.
