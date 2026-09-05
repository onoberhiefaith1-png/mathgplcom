# Speed Performance

A reporting layer on top of the timer data that already exists. The timer, the way students attempt timed assignments, and assignment expiry are not touched.

Entry point: inside Reports, a new **Speed Performance** card. Teachers open it from the class report, students from their own report. No new top-level navigation.

## What each side sees

**Student** — one row per timed question in their class assignments: the question, **Your Best**, **Overall Best**, and how far behind they are. When their time equals the overall best, the row shows "You currently hold the overall best". No other student's name, time, ranking, leaderboard, or record-holder identity is ever sent to a student — the privacy boundary is enforced in the database function, not just hidden in the UI.

**Teacher** — pick the assignment, then per question see **Overall Best**, the **Record Holder** by name (guests appear as "Guest"), the full list of every student's best time, and the **Record History** showing how the record changed over time.

Best Time always means the student's fastest successful attempt, never their most recent one. Overall Best is recomputed from the stored attempts, so it updates by itself the moment someone goes faster; every attempt stays in the database.

## Scope decisions already settled

- Times are reported **per question**, since that is the granularity the existing timer records. There is no invented assignment-level total.
- Guests arriving through a public link can hold the overall best; a student sees the time anonymously, and a teacher sees "Guest".
- No averages, streaks, or reward engine in this version. The data is shaped so a rewards layer can count records held later.
