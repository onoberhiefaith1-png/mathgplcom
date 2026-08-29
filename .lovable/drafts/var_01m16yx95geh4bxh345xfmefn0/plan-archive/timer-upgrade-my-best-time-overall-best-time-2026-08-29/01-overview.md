# Timer Upgrade — My Best Time & Overall Best Time

The existing timer stays exactly as it is: it still starts on first input, pauses when the student leaves, resumes on return, records valid attempts and keeps the student's fastest time. This change is about how that same data is aggregated and shown.

## What the student sees

On the board, the timer area shows the running clock plus exactly two statistics for the current question:

- **My Best Time** — the student's own fastest successful attempt on that question.
- **Overall Best Time** — the fastest successful attempt by anyone on that same question, guests included.

No names, no positions, no leaderboard, no per-student list. The class ranking drawer is removed from the student board (the teacher keeps their own Best Times panel on the Assignment dashboard).

## How the two numbers are worked out

- My Best Time: the minimum elapsed time across the current user's successful attempts for that exact question — already stored, unchanged.
- Overall Best Time: the minimum successful time for that exact question across every eligible attempt — class students, students opening the assignment normally, and guests arriving through a public link. It recalculates whenever a new valid attempt lands, so a faster time replaces it and a slower one changes nothing.
- Everything is per question. A 10-question assignment has 10 independent pairs of values; times are never combined across questions.

## Guests count, but stay guests

Guest solving time for a question is recorded alongside the guest's existing isolated result, and it feeds the Overall Best Time benchmark only. A guest still never becomes a student, never joins a class, and never appears in student progress or dashboards.
