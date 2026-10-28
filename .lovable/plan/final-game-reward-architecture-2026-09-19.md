# Final Game reward architecture

## Outcome
Reorganize the existing Slate reward system without redesigning the Game, replacing its artwork, or creating another mathematics engine.

The Play HUD will show four independent, persistent resources in the saved premium style:

```text
TIME  |  LIFE  |  VAULT  |  COMPLETION
```

- **Time**: current overall game/question time.
- **Life**: collected Lives available to extend an expired overall timer.
- **Vault**: reward value earned only from mathematically triggered Vaults.
- **Completion**: one Completion Coin for every solving line accepted as correct/equivalent.

## 1. Separate universal completion from configurable rewards
- Remove the current Mark Seal/completion icon from the teacher’s reward picker.
- Preserve its existing artwork/effect as an automatic completion effect owned by every solving line.
- Use the existing Floating Numbers/AI accepted-line signal as the only completion trigger.
- On the first accepted completion of a line: play the effect, mark the line achieved, increment Completion by exactly one, and persist it.
- Keep this independent from Vault, Life, Hourglass, Bomb, and Collector outcomes.
- Do not award it twice if an already-completed line is revisited or replayed within the same run.

## 2. Clean teacher reward configuration
The general Rewards picker will contain only:

- Life
- Bomb variant 1
- Bomb variant 2
- Horizontal Collector
- Vertical Collector

Hourglass and Vault remain absent from this picker because the current code already derives them from line configuration.

### Life time value
- Add one Game-level Life multiplier setting using a numeric control from **0.1× to 10.0×**, stepping by **0.1**.
- Calculate one Life’s added time as `Total Game Time × Life multiplier`.
- Preserve existing saved Games by converting the legacy full/half/third/quarter values to numeric equivalents.
- When overall time expires, consume one stored Life and continue for the calculated duration; with no Life, retain the existing failure/reset behavior.

### Hourglass
- Keep Hourglass generated automatically only when its Floating Numbers line has a timer.
- Keep the existing line-specific bonus relationship configurable beside that line.
- Start its countdown only when the student first enters mathematical content on that line.
- Keep Hourglass immune to Bombs and Collectors.

### Vault Codes
- Keep Vault Codes beside each line’s Floating Numbers/question configuration, with multiple independent codes per line and the existing maximum of ten.
- Show expressions and reward values only in the teacher editor.
- Save each code against its exact Floating Numbers line identity.
- Never render hidden expressions on student Game surfaces, student controls, or visible student text.
- Move student Vault detection behind an authenticated server boundary so hidden expressions are not delivered to the student page; send the student’s structured line mathematics for checking and return only matched Vault identifiers/reward outcomes.
- Reuse the existing canonical mathematics parser/equivalence representation, including operators, grouping, fractions, powers, and equation structure; remove the loose substring fallback so a partial token cannot open a Vault.
- A matching Vault opens once, reveals through the existing Vault animation, increments only the Vault counter by its configured value, and persists as consumed.

## 3. Make physical reward interactions authoritative
Create one shared eligibility and visibility result used by both the 3D effect and the saved reward outcome.

### Bombs
- Keep both current Bomb variants and artwork.
- On activation, calculate targets from rewards physically visible in the fixed Game camera at that moment.
- Eligible targets: Life, Horizontal Collector, Vertical Collector, and Vault.
- Protected targets: universal Completion, Hourglass, both Bombs, and all top-HUD resources.
- Off-screen/under-floor rewards remain untouched.
- Consume and apply only the targets actually reached by the visible blast; remove the current unrelated Life penalty from activating a Bomb.

### Collectors
- Keep Horizontal and Vertical Collectors as moving 3D world objects, never screen overlays.
- Horizontal Collector travels to one screen edge, sweeps to the opposite edge, then disappears.
- Vertical Collector travels to the upper edge, sweeps to the lower edge, then disappears.
- Detect collisions progressively along the physical path and activate/consume each eligible visible reward only when crossed.
- Eligible Collector targets are line rewards other than the source Collector; Completion and Hourglass remain protected.
- Visibility, world position, direction, collision order, and consumption will come from the same result used by the animation, preventing visual and saved outcomes from diverging.

## 4. Runtime state and persistence
- Replace the shared `coins` meaning with separate persisted `vaultReward` and `completionCount` values.
- Preserve existing progress safely: legacy `coins` becomes Vault value; Completion is rebuilt only from recorded completed-line state where available and otherwise starts at zero to avoid inventing achievements.
- Persist completed line identities across question changes so the Completion counter represents the whole Game run, not only the currently displayed question.
- Persist collected Lives, consumed reward identities, Vault value, Completion count, current question/line, and run status.
- Reset clears run progress, four HUD values, consumed states, timers, and student working, while preserving all teacher design and reward configuration.

## 5. HUD
- Keep the existing compact premium Game HUD and its saved styling.
- Display four clearly separated indicators: **TIME**, **LIFE**, **VAULT**, **COMPLETION**.
- Use the distinctive existing Vault icon for Vault and the existing completion coin/seal artwork for Completion; do not reuse a generic coin for Vault.
- Keep the line-specific Hourglass countdown separate from overall TIME without turning it into a fifth stored resource.
- Ensure all indicators fit on laptop, desktop, tablet, and mobile without covering the Game or Floating Numbers controls.

## 6. Validation
Create the specified test configuration:

- Total time: 10 minutes.
- Line 1: Life at 0.5×, Bomb, Vault `x + 7`, timer 2 minutes.
- Line 2: Horizontal Collector, Vault `10 + 2x`, timer 30 seconds.
- Line 3: Vertical Collector and Life.

Verify:

1. Correct/equivalent completion automatically plays the universal effect and increments Completion once.
2. A Vault can increment Vault without incrementing Completion.
3. Life is collected independently and adds five minutes when consumed in this test.
4. Both Bomb variants affect only eligible rewards currently visible in the camera.
5. Bombs never consume Hourglass, Completion, other Bombs, or HUD resources.
6. Collectors visibly traverse the 3D world and consume rewards only upon physical crossing.
7. Off-screen rewards remain untouched by Bombs and Collectors.
8. Hourglass is derived from its line timer, starts on first mathematical input, and awards its configured bonus.
9. Vault matching accepts the configured mathematical structure, rejects partial tokens, stays line-specific, and opens each Vault only once.
10. Student-visible UI and page text contain no hidden Vault expressions.
11. Every reward remains attached to its saved line through navigation, reload, resume, and reset.
12. The four HUD indicators remain separate and persist correctly.

## Technical changes
- Update the reward registry/picker, Game settings types/default normalization, line reward derivation, teacher Questions/Rewards controls, Game runtime state, 3D targeting/collision callbacks, Play HUD, progress schema, and focused reward tests.
- Add authenticated server-side Vault matching that invokes the existing canonical math utilities without exposing teacher codes.
- Add a database migration with explicit authenticated/service grants and existing row-level access protections for any new persisted fields or protected Vault configuration.
- Keep existing visual assets, Game Edit layout, writing surfaces, camera behavior, Floating Numbers controls, and AI evaluation pipeline unchanged.
