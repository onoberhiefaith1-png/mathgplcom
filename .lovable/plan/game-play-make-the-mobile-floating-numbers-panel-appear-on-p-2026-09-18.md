# Game Play: make the Mobile Floating Numbers panel appear on Play

## What the user is seeing

The Game editor already has a Play button. `/game/play/:id` already renders the 3D slate with `PresentationView chrome="game"` and passes `activeLine` / `onLineText`. Game chrome hides everything in the Smartboard except `[data-floating-halo]` (the Mobile Floating Numbers panel).

So the wiring exists, but the panel is not showing when the student clicks Play. The reason is inside `PresentationView.tsx` at the panel mount:

```
visible={(activeAssistant === "numbers" || (gameChrome && activeAssistant === null)) && reservoirs.length > 0}
```

If the attached question compiles to zero reservoirs, the panel never renders — the whole Game screen is just the 3D slate with no controls. That is exactly the "no Play experience, no Floating Numbers display" the user reports.

## What we will change

Scope is only the Game Play surface. Floating Numbers, Smartboard, marking, AI and rewards stay exactly as they are.

1. Guarantee the Mobile Floating Numbers panel appears on Play
   - In `PresentationView.tsx`, when `chrome === "game"`, drop the `reservoirs.length > 0` gate. The panel must always mount, docked at the bottom, from the moment Play is pressed. If the question has not yet produced reservoirs, the panel shows its own empty state — never a blank screen.
   - Keep the auto-open assistant effect for game chrome so `activeAssistant` is treated as `"numbers"` by default.

2. Sensor / active surface is the single source of truth for the active line
   - `GamePlayPage.tsx` already passes `activeLine = currentLine − 1` into `PresentationView`, and `runtime.selectLine` fires when the student taps a slot. Confirm this is the only cursor:
     - Remove any residual local `activeLineIdx` writes inside `PresentationView` when `gameChrome` is on — the game owns it.
     - When the student scrolls the slate and a new writing surface enters the active region, `WorldStage` / `SlateColumn` must call `onSelect({ kind: "slot", slotId: "line-N" })` so `selectLine(N)` runs and the panel switches to Line N.

3. Surfaces mirror the exercise's line count (already in place — verify only)
   - `syncLineSurfaces` on attach already creates one surface per Floating Numbers line and removes orphans. Confirm that a freshly attached 5-line question shows exactly 5 surfaces in `displayGame`, regardless of any older manual count.

4. Line completion pipeline (already in place — verify only)
   - `onLineText` streams the student's live per-line text to `useGameRuntime`; the existing Floating Numbers evaluation and `consumeLine` already own marking and reward activation. No new checker.

5. HUD stays unchanged
   - Exit, question / line counters, coins, lives, question time, line time, marks + %, Reset — all already rendered. No visual redesign.

## Out of scope

- No changes to Floating Numbers input, marking, equivalence, reservoirs, or the Smartboard.
- No changes to Classes → Game → Adventure navigation or to assignments / reports.
- No new "Game-only" math component.

## Technical notes

- File touched: `src/components/smartboard/PresentationView.tsx` — one condition change on the `FloatingNumberPanel` `visible` prop and (if present) removal of the internal `activeLineIdx` write under `gameChrome`.
- File touched: `src/pages/game/GamePlayPage.tsx` — only if the scroll-driven surface change does not already emit `onSelect`; add a small effect that maps the currently framed slot to `selectLine`.
- No schema changes. No new tables. No migration.
- Verify with `bunx tsgo --noEmit`, the slate vitest suite, and a Playwright pass on `/game/play/<a game with a 5-line question>` that (a) the docked panel appears immediately on Play, (b) tapping surface 3 switches the panel to Line 3, (c) submitting the correct value on Line 3 awards the mark and activates the reward.
