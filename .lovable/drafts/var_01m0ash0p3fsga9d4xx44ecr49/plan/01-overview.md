# Active Subtopic as the AI's working context

Today the subtopic is only text on the page: "＋ Add Subtopic" inserts a level‑1 heading, and each AI feature separately guesses which subtopic it belongs to by walking headings above the caret. Some AI paths (Floating‑number persistence, Geometry Map, whole‑note AI edit) skip that walk entirely and fall back to the notebook's original subtopic — which is why newly entered subtopics are ignored and generation drifts back to the previous one.

This change makes the subtopic real application state — the **Active Subtopic** — and makes every AI request read it from one place.

## What the teacher sees

- The Add Subtopic composer gains a visible **Enter** button beside the input (keyboard Enter keeps working).
- Empty input shows "Please enter a subtopic." and creates nothing.
- Typing a subtopic that already exists in the note activates it instead of inserting a duplicate heading; the caret moves to that subtopic.
- Confirming shows a short confirmation: "Active subtopic changed to Tangents to a Circle."
- A persistent badge sits with the AI/section controls: `Topic: Geometry · ACTIVE SUBTOPIC: Tangents to a Circle`. Clicking it opens the list of subtopics in the note so the teacher can switch back; clicking a subtopic heading in the document also activates it.
- Previous subtopics and their content are never touched or regenerated. Only future generation changes.
