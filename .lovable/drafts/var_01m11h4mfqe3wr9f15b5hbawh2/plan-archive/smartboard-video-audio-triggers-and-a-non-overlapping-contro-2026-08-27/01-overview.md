# Smartboard video: audio, triggers and a non-overlapping control stack

A refinement of the existing lesson-video layer only. The Smartboard, floating
numbers, marking, Practice/Discuss links, teacher panels and stored video
segments all stay exactly as they are.

Four things change:

1. **The control rows stop overlapping.** The Smartboard / Split view / Video
   switcher currently floats at the very top centre of the screen, in the same
   place the board's own Back + title + progress strip sits. It moves to its own
   row directly underneath that strip, on both teacher and student boards.
2. **The video gets real, working audio with a compact volume control.** One
   player, one audio state — play, pause, mute/unmute and a live volume slider
   that survive switching between Smartboard, Split view and Video.
3. **Playback follows the lesson, not a playlist.** Introduction plays as soon
   as the board opens (when one exists). A floating number activating a line
   makes that line's segment the active one. Line 6 being *marked* — not merely
   shown — triggers the Conclusion. Only ever one instructional audio source.
4. **Replay is decided by the awarded mark.** Returning a floating number to a
   line that has already earned its mark does not auto-replay it; a line with
   no mark yet still plays every time. Previous / Next stay manual and always
   available.
