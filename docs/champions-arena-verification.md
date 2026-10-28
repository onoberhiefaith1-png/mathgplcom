# Champions Arena and reliable completion verification

## Final behavior

The report uses the existing competition-scoped, server-verified personal bests. The overall podium requires every question in the competition and ranks the average of those best times. Twenty questions fit in a five-column/four-row desktop grid; larger sets paginate without changing overall qualification. Narrow/short windows use an overview and selected-question detail. Only ranking lists scroll. Container measurement, dynamic viewport height, fullscreen resize and document overflow cleanup keep the display fitted.

The gold overall winner is raised above the runners-up. Navy card headers, gold champion rows and restrained ranking animations retain readable names/times. Photo settings are preserved.

## Completion corrections

- A local predictive award remains pending until its grade-line persistence request succeeds. An already-visible local mark no longer skips that write.
- Writes to the same assessment/participant namespace run in order; read-only pre-clearance remains parallel.
- A stale server response merges earned slots instead of lowering the visible score. Responses belonging to a different board identity are ignored.
- Migration 0021 installs before-update triggers which merge permanent verified marks under the database row lock, recompute the score, and retain completed status on stale snapshots. It does not evaluate expressions or grant database access. Reset continues to clear the temporary attempt rather than permanent achievement.
- The timed score is the current attempt's scored requirements. Notes and zero-mark text do not hold a full-mark attempt open. All scored steps, including the final one, remain required.
- The final scored step stops the clock before the full-score frame is painted, submits once, and leaves the completed attempt stopped. A fresh reset can improve the personal best.
- A saved marking write wakes pending Arena confirmation; realtime broadcast remains the primary report update path, with a faster polling fallback.
- An acknowledgement for an older elapsed time cannot erase a newer queued completion.

Equivalence rules, server completion verification, canonical Practice/Play mapping, competition isolation and atomic best-time promotion are preserved. No invented or manually inserted student times are used.

## Verification

117 automated tests pass across 15 suites. Coverage includes complete-only podium eligibility, averages across every page, improved personal bests, ties, timing stop/restore/reset, final-step requirements, pending grade persistence, ordered participant-scoped writes, stale marks, retry acknowledgements, submission/presence/photo/account/narration regressions, pagination and fullscreen state.

60 actual-component browser fixture cases passed: every required count (1, 2, 5, 8, 10, 15, 20, 21, 40) at five desktop/laptop sizes, plus 15 phone/tablet/short-window combinations. All cards fit, first five rankings are visible, and document dimensions do not exceed the viewport. Q1 keyboard scrolling left Q2, podium and document positions unchanged. Q21–40 fit on page two with an unchanged overall podium. Fullscreen entry/exit preserved the display.

Database tests used temporary tables inside rollback-only transactions for both guest and registered progress. Two stale snapshots retained both awarded slots, reached full score, and a late partial snapshot did not reduce it. No real student marks were changed by these tests.

Previews use synthetic students/results. Targeted Arena TypeScript checking and changed-module syntax checks pass. Local source is a partial checkout: a hosted application build and live report smoke test remain release checks rather than claims from the local harness.

## Release procedure

Apply `drizzle/migrations/0021_verified_progress_merge.sql` before publishing the merged revision. Confirm the hosted build and real competition view; verify actual completion/report handoff in an isolated test group where available. No edge-function deployment is required: the existing grader is retained, with ordered client requests and atomic database update protection.
