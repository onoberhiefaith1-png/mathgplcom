# Make the Game write, respond and reward correctly — one pass

## What the Game is (so we agree on the target)

A teacher builds one Game stage: background, room, writing slabs, lighting and placed rewards. A question comes in from a lesson note. That question's Floating Numbers lines become the stage's surfaces:

```text
Surface 0 = the question, read-only, no rewards, no marks
Surface 1 = Floating Numbers Line 1
Surface N = Floating Numbers Line N
```

The student writes only through the Floating Numbers panel at the bottom. Their working appears on the matching surface as it is typed. The Smartboard engine marks each line on its own, the instant the line becomes equivalent — nothing is merged between lines and nothing waits for the student to move on. A marked line pays its own rewards, raises the completion coin, and only then reveals that line's teaching note. Vaults open on their own encrypted code inside the student's own working. Hourglasses run only on the line being written. Bombs and collectors sweep the world and chain other objects, but never open a vault, a coin or an hourglass. Reset clears the run, never the teacher's design.

## What is actually wrong (found in the code, not guessed)

1. **The text is invisible by design when one asset fails.** The flat, fast text is drawn with its fill set to fully transparent as soon as typing settles, and everything visible after that comes from carved 3D letters built from a separately downloaded font file. If that download fails (the live console shows a failed load), or the line is longer than the carving limit, or the carving returns nothing, the code draws *nothing at all* and never falls back. That is exactly the empty glass panels in the screenshot — including the missing question on Surface 0.
2. **A suspended writing area renders as empty.** Both the writing area and the reward objects are wrapped so that "not ready yet" means "draw nothing", with no visible text behind them.
3. **Typing goes stiff after the first characters.** Every settled change re-carves letters on the main thread, in the same frame the student tapped, and the update passes through three separate delay layers before reaching the slab. The live log shows the interface blocked for 1.5–3.2 seconds on the canvas, plus repeated graphics-context losses that leave the board no longer updating.
4. **Rewards can fire without a mark.** Reward firing is driven by a broadcast event and by chain sweeps; there is no single check that the line was actually marked before a bomb or collector is allowed to go off.
5. A stray script error (`v is not defined`) is still reported on this page.

## The fix

### 1. Text that is always visible (the core rebuild)

- The fast text layer becomes the real, always-visible mathematics. It is never made transparent and never waits for anything.
- The carved 3D depth becomes a decoration drawn *on top of* it when its font is ready. A failed or slow font, a long line, or a carving error now changes only the depth, never whether the student can read the line.
- Fonts are fetched once during startup, with retry, and cached; a permanent failure is recorded so the Game stops retrying and simply stays flat.
- Both "draw nothing while not ready" fallbacks are replaced by the flat text of that same line, so a surface can never appear blank while it holds content.
- Surface 0 shows the question through the same always-visible path.

### 2. Instant response while typing

- A keystroke updates the slab text immediately: one path, no settle timer, no extra deferral layers stacked on it.
- Carving of the 3D depth moves off the typing path entirely, onto idle time, and is skipped while the student is actively typing — it catches up when they pause.
- Graphics-context loss restores the board and its caches automatically instead of freezing the visible state.
- Lines that are not the active line do no work on input at all.

### 3. Notes appear only after the mark

Kept and verified: a line's teaching note is shown only once that line has earned its marks. A half-written line, or jumping away from it, shows no note.

### 4. One gate for every reward

A single rule decides whether an object may fire:

- the line was marked correct (completion coin, hourglass payout, life, bomb, collector on that line), or
- a vault's exact code appeared in order in that line's own working, or
- a bomb/collector that fired legitimately physically reached it.

Anything else — a tap, a broadcast, a restored save, a partly written line — only selects the line. Vault, completion coin and hourglass stay out of every chain.

### 5. Verify before reporting done

Live play on phone and desktop, signed in, on a real assigned Game:

1. Question readable on Surface 0 at open.
2. Each tapped chip appears on the correct surface in the same moment, for 40+ characters without stiffening, on lines 1, 2, 3 and after jumping between them.
3. A line marked the instant it becomes equivalent; coin rises; note appears only then.
4. Vault opens on its code and counts `n/total`; no bomb or collector fires before its line is marked.
5. Hourglass counts on the written line only; expires permanently; pays the teacher's multiple when solved in time.
6. Collector sweeps to both edges, chains bombs and hearts, leaves hourglass/coin/vault untouched.
7. Reset clears the run, design untouched.
8. No script errors in the console, including `v is not defined`.

## Technical notes

- `DimensionalText`/`TileText`: SDF fill opacity no longer keyed to `extrusionSettled`; extrusion becomes additive and gated on font availability; remove the 220 ms settle in favour of an idle-scheduled carve with an active-typing guard.
- `ExtrudedExpression`: font preload + retry at boot, permanent-failure flag, glyph-count cap raised/handled gracefully instead of returning `null` for the whole line.
- `SlateColumn`: `Suspense fallback` for the writing region falls back to flat text rather than `null`; reward fire path funnels through one `mayActivate(line, rewardId, cause)` check.
- `GamePlayPage`/`useGameRuntime`: drop redundant deferral layers on `lineText`; restored `consumedRewardKeys` no longer re-broadcast activations on load.
- WebGL context-restore rebuilds the geometry/material caches.
- Tests extended: text visible with font load failed, text visible while suspended, no reward activation without a mark, note hidden until mark.

## Not changing

No new mathematics, no new marking engine, no redesign of the slate, the rooms, the rewards or the teacher's saved Games.
