## What gets built

**1. One action that writes a whole question properly**

A new ability, "write a question with its solution": given the note and the session kind, it makes
the Example (or Exercise, Classwork, Homework) session, writes the question line as the *question*
and the worked steps as the *solution*, both belonging to that session — then reads them back and
reports the session id, ready for highlighting. One call, one complete question.

**2. Writing loose lines becomes honest**

Writing plain lines stays available for Introduction, Explanation and Summary. If it is used inside a
session, it must say whether the lines are the question or the solution; used on an Example-type
section without that, it refuses and tells Aura to use the question action instead. That removes the
route that produced "Example 1 … solved" as prose.

**3. Reading a note shows the structure, not just the words**

When Aura reads a note back she sees, per session: its id, its question, its solution line count, and
whether Floating Numbers exist yet — plus a warning for any session with no question, a question with
no solution, or a solution with no chips. She can then see her own mistake instead of reporting success.

**4. The understanding, written down**

Her lesson-note knowledge and operating rules gain the explanation, in teaching language:

- An Example is not a line of text; it is a session: heading, question, solution beneath it.
- The Solution belongs to that question and to no other — the Smartboard steps session by session,
  so teacher board and student board are always on the same question.
- Floating Numbers are cut out of that question's own solution lines. No solution, no chips; a
  solution edited afterwards, stale chips.
- Assigning hands over the session as one thing, so the student receives the same question, the same
  solution order and the same chips the teacher prepared.
- Multiple worked examples mean multiple sessions — Example 1 and Example 2 are never two lines in
  one section.
- After writing the solution she highlights it, asks the one real choice (chips in solution order or
  shuffled), generates, and offers the Smartboard try-out before assigning.

**5. Checks**

Tests that the new question action produces a session with a labelled question and solution, that
loose writing is refused inside a question session, that reading back reports the warnings, and that
the operating rules carry the session/solution/floating explanation. Then one real run: ask Aura for
a lesson note with two worked examples and confirm two separate sessions, each with its question,
solution and generated Floating Numbers.

## Not in this pass

Smartboard presentation behaviour, the Floating generator itself, pedagogy rules and the maths
engine are untouched. Classes, assignments, games, Adventures and outside services keep exactly the
abilities they have today.
