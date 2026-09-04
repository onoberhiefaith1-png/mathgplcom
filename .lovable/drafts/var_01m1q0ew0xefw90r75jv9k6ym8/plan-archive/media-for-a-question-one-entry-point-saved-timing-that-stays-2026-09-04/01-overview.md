# Media for a question: one entry point, saved timing that stays put

Today a question has an **Add Video** button. The teacher uploads one video, types a start and end time for every line of the solution, and saves. Saved timings live in the exercise card's own settings, under the question's id.

Two things change:

1. **Media instead of Add Video.** One button, then a choice: **Video** or **Audio**. Both use the exact same timeline (start, end, duration, per-line positioning, preview, play/pause, save, edit). Video shows the picture side by side exactly as it does now; Audio shows a player and a waveform-free timeline only — no fake video area.
2. **Saved timing is locked and permanent.** After Save, the timeline shows as saved and read-only with an **Edit** action. Reopening the course, refreshing, or moving between questions reloads exactly what was saved. Nothing is recalculated from the media length.

## What is likely causing the scattering (to be confirmed first)

Each saved timing is filed under the id of the solution line it belongs to. The teacher page builds the line list from the freshly prepared practice board for that question, while the saved timings were written against the line ids of the stored question. If those two lists do not carry the same ids, every saved start/end stops matching its line and the editor shows each section as unset — which reads exactly as "reset to zero / stretched to the whole video / scattered".

This is a strong suspicion, not a confirmed fact. Step 1 of the work is to read the saved record and both line lists for a real question and prove or disprove it, then fix the actual cause. No guessing fixes.
