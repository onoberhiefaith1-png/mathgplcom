# Game opens within 10 seconds with real progress

## Goal
Open the teacher’s already-saved Game directly, never show substitute white surfaces, never leave the loading screen indefinitely, and make the progress bar represent completed startup work from 0% to 100%.

## Fix the permanent loading loop
- Separate the saved physical writing surfaces and their click targets from optional three-dimensional text, numbers, reward labels, artwork, lighting, and effects.
- Report the core stage ready after the real saved surface geometry and its pointer targets have painted, even when optional fonts or artwork are still loading.
- Keep optional text and visual details in isolated non-blocking layers so a failed font or asset can never prevent the Game from opening.
- Reset readiness correctly after graphics recovery without rebuilding or replacing the teacher’s saved design.

## Enforce the 10-second maximum
- Add one startup controller shared by Game Edit and Game Play.
- Use a hard 10-second deadline for the interactive core stage.
- Before the deadline, reveal immediately as soon as the real surfaces are ready; do not deliberately wait for the timer.
- At the deadline, reveal the usable saved surfaces with safe material/text fallbacks while unfinished optional details continue loading in the background.
- If the browser cannot create any graphics surface at all, replace endless loading with a clear retry state at 10 seconds; never leave the progress display frozen.

## Show truthful loading progress
- Replace the moving shimmer with a determinate percentage and a bar whose filled width only moves forward.
- Drive progress from actual milestones rather than a looping animation:
  - 10%: Game request started
  - 30%: saved Game and question data loaded
  - 50%: graphics canvas created
  - 75%: saved writing-surface geometry mounted
  - 90%: click targets verified on a painted frame
  - 100%: Game revealed and interactive
- Display the current percentage beside “Preparing writing surfaces.”
- Hold at the latest genuine milestone during slow work; never pretend completion based only on elapsed time.
- Preserve reduced-motion support while keeping percentage updates visible.

## Use the saved arrangement directly
- Keep the saved Game configuration as the source of truth for surfaces, positions, scales, materials, rewards, room, and background.
- Do not regenerate the teacher’s layout during Play; derive only the current question text and runtime reward state by stable line ID.
- Keep the saved background visible during startup when available and defer premium lighting, effects, and unused reward artwork until after interaction is available.
- Keep Floating Numbers, line selection, timers, grading, reward activation, and Reset behavior unchanged.

## Verification
- Cold-open Game Edit and Game Play on desktop and phone and confirm both either open earlier or leave loading by 10 seconds.
- Confirm progress advances monotonically through real milestones and reaches 100% exactly when controls become usable.
- Simulate slow and failed fonts/artwork and confirm the real surfaces still open without white substitutes.
- Test Lines 1–3 clicks, rapid Floating Numbers input, surface growth, timers, proactive marking, rewards, save, reset, and graphics recovery.
- Add focused tests for milestone progress, the 10-second deadline, stale readiness callbacks, optional-asset failure, and Edit/Play parity; run the Game/Slate regression suite and type checks.

## Technical notes
- The current deadlock is caused by the readiness callback living inside a suspended three-dimensional subtree. If optional text waits, that subtree never paints and can never declare itself ready.
- The new readiness contract will be owned by non-suspending surface geometry. Optional presentation layers cannot participate in the gate.
- The 10-second guarantee applies to leaving the loader. Normal operation should complete substantially sooner because saved layout data and core geometry are rendered first.
