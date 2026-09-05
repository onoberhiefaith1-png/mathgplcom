# Stop the marker saying "Equivalent" for work that isn't

## What is happening

I traced the marking engine that decides a student's line. When the expected line and the student's line both contain an equals sign, the engine does not compare the two lines. It moves each line to one side (left minus right) and compares those two leftovers.

That works for solving steps, but it breaks badly for the most common kind of expected line — one where both sides are already the same value, such as `5 + 5 = 10`, `3x + 2x = 5x`, or any simplification step. For those, the leftover is zero. Any true thing a student writes — `2 = 2`, `1 + 1 = 2`, `y = y`, or a correct line from a completely different question — also gives zero. Zero equals zero, so the engine reports "Equivalent" and awards the marks.

That is exactly the behaviour being seen: the student starts writing anything, and it is marked correct.

There is a second, smaller hole: when the checks cannot decide, the question goes to an AI judge that is only told "are these equivalent", with no instruction to reject a line that is true but unrelated.

## What I will change

1. A student line whose own two sides are trivially the same (leftover of zero) is never accepted on its own. It only counts when the expected line is itself that same statement.
2. When the expected line is a simplification/identity, require a real side-by-side match: the student's left side must match the expected left side and the right the expected right side (sides may be swapped, since `10 = 5 + 5` is the same statement).
3. When the expected line is a genuine equation being solved, keep the current leftover comparison — that correctly accepts valid alternative steps — but reject a vacuous (zero) student leftover.
4. Add a relevance guard: letters used in the student's line must come from the expected line, so `y = y` can never be marked for a line about `x`.
5. Tighten the AI fallback prompt and post-check it, so a true-but-unrelated line is rejected rather than waved through.

Nothing about the board, the popup wording, the marks per line, the timer, the score storage, or the teacher panels changes. Only the correct/incorrect decision gets stricter.
