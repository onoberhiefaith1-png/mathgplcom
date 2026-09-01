# Lesson Note — question and solution as one linked item

Goal: a solution can never exist, appear, disappear, move or be renumbered on its own. Every solution is permanently bound to one question: same number, same block, same lifecycle.

What I confirmed in the current code:

- When a question section is created, the Solution heading is inserted with **no owner link at all** — the pairing is only "the Solution that happens to sit below this heading". That is why a solution can look detached once the question is written, edited or moved.
- The existing self-healing pass only repairs solutions that live in free canvas frames. In-flow Solution headings are not healed, and **nothing removes a Solution whose question was deleted** — the orphan stays in the note.
- Automatic numbering assigns "Solution 1" by position, not by ownership, so a drifted or orphaned Solution can be renumbered onto the wrong question.
- Copilot already builds each item as question → figure → solution in one pass, so the build order itself is correct. What it lacks is a **hard structural link** and per-question pairing when one section holds several questions.

Nothing about lesson design, styling, pedagogy rules, or the maths engine changes. This is structure and lifecycle only.
