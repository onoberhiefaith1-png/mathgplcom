# Interactive Teaching Video on the Exercise Card

Add a teaching-video layer on top of the existing Exercise Card, Test Smartboard, Floating Numbers / Present line engine and automatic marking. Nothing in the mathematics, evaluation or marking pipeline is rebuilt or changed — the current mathematical line becomes the bridge that drives the video.

## What the teacher gets

1. **View on a saved Exercise Card** — a question list for the card (already exists on the student side; the teacher gets the same list at `/teaching-hub/classes/:classId/courses/:courseId/exercise/:blockId`). Selecting a question opens the existing Test Smartboard for that question, with Floating Numbers, Present, Evaluation, automatic marking and all current board controls untouched.
2. **Add Video** inside the Test Smartboard. With no video attached, the board behaves exactly as today.
3. **One upload, virtual sections.** The teacher uploads a single continuous video. The section list is generated from the question's own mathematical lines: optional Introduction, then Line 1..Line N (mandatory, cannot be disabled), then optional Conclusion. The teacher only marks where each section *ends*; the previous checkpoint is automatically the next section's start.
4. A checkpoint editor with the video scrubber: "Set at playhead" per section, ordered and clamped, plus mm:ss entry. Optional rows show an enable toggle; mandatory line rows are clearly marked as required.

## What the student gets

Course → Session → Exercise Card → question list → the same solving board as today. If the question has a video, a three-view switch appears:

- **Left** — Smartboard only
- **Middle** — Split (Smartboard + video)
- **Right** — Video only

Default is Split on wide screens and Smartboard on phones. The choice is remembered per device.

## The teaching cycle

The video's section for the student's current mathematical line plays, then **pauses at that section's end checkpoint**. The student solves the line; the existing evaluation awards the marks; moving to the next line makes the video jump to that line's section and play again. Watch → stop → try → evaluate → continue.
