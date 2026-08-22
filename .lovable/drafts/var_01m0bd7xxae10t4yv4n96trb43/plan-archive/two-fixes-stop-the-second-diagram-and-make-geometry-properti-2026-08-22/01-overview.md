# Two fixes: stop the second diagram, and make Geometry Properties teacher-authored

## Part A — remove the extra diagram above the Solution

Confirmed cause: the blueprint prompt in the AI generator was recently given the rule
"when the question's data lives in an already-drawn diagram … **set diagramRequired true**
and reuse its exact labels". So when a question already has its correct diagram, the
blueprint still says a diagram is required, and the pipeline draws a fresh one and inserts
it above the Solution.

Fix, narrowly:

- Reword that rule to the opposite intent: an existing diagram is the given information and
  must be reused as-is — never re-described, never re-drawn (`diagramRequired` false when the
  block's question already owns a diagram).
- Add a hard client-side guard in the generation runner: if the target question already owns
  a diagram, the diagram stage is skipped entirely, whatever the blueprint says.
- Nothing else changes. The original diagram generation path (for questions with no diagram
  yet) stays exactly as it is, and it keeps rendering between Question and Solution.

Result: one question = one diagram, always.
