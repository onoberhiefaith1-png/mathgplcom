## Playback rules

- **Section for the current line.** Section *k* runs from checkpoint *k-1* to checkpoint *k*. Introduction ends at the first checkpoint; Conclusion runs from the last checkpoint to the end of the video.
- **Pause at the boundary.** Playback stops when the playhead reaches the current section's end. It does not spill into the next line's explanation.
- **Skipping is allowed.** Line 1 → Line 7 jumps straight to the Line 7 section. Lines 2–6 are never forced.
- **Returning to a completed line.** If that line already has awarded marks in the existing progress state, the section does not auto-replay; the student can replay it manually. If the line is not yet correct, its section plays again.
- **Video-only controls.** In Video view, Previous / Next step through sections and a Replay section button restarts the current one. None of these touch the mathematical state. A "Back to my line" button re-syncs the video to the current mathematical line.
- **No second completion model.** Completion, marks and progression all come from the existing evaluation state; the video reads it and never writes it.
- **Introduction.** When enabled, it plays once at the start of the question before Line 1's section, then the normal cycle takes over. Conclusion, when enabled, plays after the final line is completed.
- **No video attached:** no three-view switch, no layout change, board identical to today.
