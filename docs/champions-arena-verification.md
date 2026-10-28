# Champions Arena draft verification

The report is a read-only projection over the existing competition's verified personal bests. No timing, marking, completion, attempt-write, reset, database schema, or participation-identity logic is changed.

- The server adds stable participant/attempt identifiers to ranked entries and returns the top three overall champions plus the count eligible.
- Overall qualification requires a positive verified best for every required question in the competition. Ranking uses the mean of those bests; ties use the latest contributing best's achievement timestamp, then stable participant ID.
- Twenty questions per page; overall qualification always uses all pages.
- Root uses the dynamic viewport, locks/restores document overflow, and measures its own container with ResizeObserver plus viewport/fullscreen resize events.
- Desktop: up to five columns and four rows. Card dimensions come from remaining viewport space; no global scaling or CSS zoom. Narrow/short screens use overview tiles with one detail card.
- Every ranking list is independently keyboard/touch scrollable; headers/podium/grid remain fixed.
- User photo settings, current competition scope, verified ranking ordering, polling, realtime nudges and stale-result protection remain in place.
- Former wheel UI and metadata are removed. Background ranking animations respect reduced motion.

## Automated checks

104 tests pass, including 25 championship tests plus the existing submission, presence, ranking, isolation, account and narration suites. Covers required question counts 1, 2, 5, 8, 10, 15, 20, 21 and 40; complete-only eligibility; improved personal bests; cross-page averages; tie order; resize/overview; pagination; fullscreen state and document overflow cleanup.

## Browser checks using actual component with synthetic fixture results

45 combinations: every required question count at 1920x1080, 1440x900, 1366x768, 1280x720 and 1024x768. All cards within the viewport, no document overflow, first five rankings visible, independent scroll areas present.

15 compact combinations: 2/20/40 questions at 390x844, 360x640, 768x1024, 1280x600 and 844x390. No document overflow; cards contained; first five rows readable. Compact overview used where necessary.

Keyboard PageDown moved Q1 from scrollTop 3 to 102; Q2 stayed at 3, document scrollTop stayed 0, podium top stayed 60px. Fullscreen entered at 1366x768 with no document overflow and exited without state loss.

Screenshots include 20-question, 2-question and phone layouts. Names/results in these previews are explicitly synthetic; no real student results were changed.

## Release checks still required

This is an unmerged draft. A full hosted app build and final smoke test against a real competition are pending approval to merge/publish. Local checks use a partial source checkout and standalone actual-component browser harness; they do not constitute a full production build or live multi-device competition test.
