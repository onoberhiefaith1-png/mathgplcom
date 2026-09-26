# Game Runtime — smoothness, responsiveness and one coordinated state

Goal: keep the Game exactly as it looks today, but make it feel like a polished 3D game — one state, one clock, one active line, one animation scheduler, a background that never restarts, and 3D objects that are reused instead of rebuilt.

No visual redesign. No removing rewards, video, 3D text or effects.

## What is actually causing the rough feel (confirmed in the code)

- The Play page re-renders itself twice every second on purpose (a 500ms "tick" used only to refresh the clock display). That tick re-runs the whole game world subtree, including the background and every surface — this alone produces jitter, stutter and input that arrives late.
- There are two separate active-line ideas: the runtime's current line, and the page's own surface selection. They are synced by effects, which is why a tap can activate and then be pulled back.
- The runtime runs two independent repeating clocks plus separate delayed callbacks; the writing-surface component adds seven more timing/animation loops of its own, and the effects layer another. Nothing coordinates them.
- The background video element's source is resolved asynchronously inside the world, so state changes in the world can re-create the element instead of letting it keep playing.

## What will change

1. One Game Runtime state — a single store holding question, active line, completed lines, written work, rewards, timer, lives, coins, vaults, completion coins, interaction and animation state. Every visual part reads from it; nothing keeps a private copy.
2. One active line — the top selector, the writing surfaces, Floating Numbers, rewards, timer, vaults, Check and Next/Previous all read and write the same value. Tapping a surface or a number selects it once and it stays selected.
3. One game clock — a single timing source drives the question timer, line timer, reward timers and the HUD display. The HUD updates at a smooth display rate without re-rendering the 3D world.
4. Background stays alive — the video element is created once, keeps its own playback, and is never re-created when a line changes, a reward fires, a number is tapped or the score moves. It sits in its own layer beneath the world with the HUD above.
5. Natural interaction — tap detection, confirm, smooth highlight, then state update. Rapid taps are coalesced into one interaction. No snapping, no double activation, no activation-then-reversal.
6. Rewards only activate on their real condition — player action, mathematical update, validation, then activation. One central reward manager owns each reward's lifecycle (idle, armed, activating, active, resolving, consumed), so two systems can never animate the same reward.
7. Rewards stay attached to their line in world space, through resize, zoom, surface growth and on any device.
8. Targeted updates only — geometry, materials, textures and glyphs are reused and cached; only the object that changed is updated. The game world is never remounted by a state change.
9. Smooth surface growth — surfaces still start compact and grow with content, updating their size instead of being destroyed and rebuilt, keeping the 5% margins.
10. Cleanup with ownership — timers, listeners, animation frames and 3D resources are released when truly unused, never while something still needs them.

## How it will be verified

Profiling first, then fixes, then a real play-through: frame time, dropped frames, draw calls, object/texture/geometry counts, active timers and listeners, memory over time — measured before and after on the real saved Game.

Then the full play test in the live app: open the Game, let the video run, select Line 1, tap numbers, write, move to Line 2 and back, use Next and Previous, tap a line directly, activate a reward, a Life, a Vault, let an Hourglass run, trigger a Completion Coin, complete and check a line, reset the attempt, reset the run, resize the window, and repeat with several rewards visible — watching for jitter, lag, duplicate activation, drifting rewards, video restarts, text flicker, HUD or timer desync and memory growth.

## Technical notes

- New `src/lib/game/runtime/` store (single reducer + selector subscriptions) replacing the scattered `useState` set in `useGameRuntime.ts` and the duplicate `surfaceSelection` in `GamePlayPage.tsx`; selectors keep the R3F scene out of unrelated re-renders.
- Remove the 500ms `forceTick` re-render; HUD time is driven by the single clock via a subscription outside React tree re-render (transient updates), keeping timing accuracy independent of display rate.
- Consolidate the two `setInterval` loops in `useGameRuntime.ts`, the seven timing/animation sites in `SlateColumn.tsx` and the ones in `Effects.tsx`/`RewardStatusBar.tsx` into one scheduler driven by a single `useFrame`/clock, with explicit animation state machines replacing chained `setTimeout`s.
- Move `BackgroundLayer` above the world-state boundary with a stable element and pre-resolved source, memoised so world state changes cannot remount it.
- Reward manager module owning id/type/lineId/worldPosition/visibility/active/consumed/eligible/animationState; rewards positioned in world coordinates from their line, not screen coordinates.
- Pointer handling audited for bubbling, duplicate listeners, stale closures and double-fired callbacks; one interaction per tap enforced at the input layer.
- Cache and reuse glyph geometry, materials and PBR textures; bounded caches with reference-counted disposal.
- Existing Slate/Game tests must keep passing, plus new tests for single-active-line, no-remount-on-state-change, one-interaction-per-tap and background-not-restarted.

## Not included

- No change to the visual design, typography, surfaces, rewards art, background, HUD look, mathematical rules or Floating Numbers behaviour, except where a demonstrated runtime bug requires it.
