# Two fixes: Ask a Question placement, and Set at playhead

## 1. Ask a Question belongs to students only

Only students ask teachers, so the button must never appear on the teacher's Test Smartboard (the board opened from an Exercise Card question). It does appear there today because that board is mounted in student mode to reuse the solving engine.

- Hide the button whenever the board is a teacher test board.
- On the real student board, move it from the bottom-left to the **top-right**, offset so it clears the existing top-right board chrome (the close/marks and floating-number icons) instead of overlapping them.
- Nothing about the question flow itself changes — same short form, same attachment to the assessment card and the question being solved.

## 2. Set at playhead must actually take effect

In the video editor, clicking **Set at playhead** currently looks dead: the time in the field does not change. The cause is not the button — it is the timing model. Every section's start is forced to be at least the previous section's end, and its end at least its own start, so a value the teacher marks that falls before the neighbouring boundary is silently clamped straight back to the number already shown. That is why Line 1 sits at `0:51 → 0:51` and repeated clicks appear to do nothing.

The fix makes each marked boundary the teacher's own value:

- A boundary written by the teacher is kept as written; the only limits are the file itself (0 to length) and `end` never earlier than `start` for that same section.
- Sections are no longer chained to each other, so marking Line 3 never rewrites Line 1 or Line 2.
- **Set at playhead** reads the live playhead of the player in the editor, writes that boundary, shows the new time in the field immediately, and briefly confirms it.
- Setting an end that precedes its own start nudges the start with it, rather than snapping back.
- The button stays disabled only while there is no uploaded video; once the file is loaded it is always clickable.
- Overlaps or out-of-order boundaries between sections are shown as a quiet warning on the row instead of being silently corrected, so the teacher can see and fix them.

Playback is unaffected: the player still seeks to the current line's section and stops at its end checkpoint, and the video session still survives every screen-layout switch.
