# Permanent Game responsiveness fix

## Confirmed cause

The Game’s graphics warmup repeatedly starts asynchronous whole-scene shader compilation while surfaces, lettering, rewards, and staged lighting are still changing. Those overlapping jobs race disposed materials, causing the observed `isReady` crash. They also compete with clicks, Floating Numbers updates, the timer, and marking on the browser’s main thread.

Each new symbol also immediately rebuilds the active line’s full extruded 3D lettering or individual 3D tiles. That expensive work happens in the same interaction frame, explaining why the mathematics eventually appears but can take seconds and why the timer visibly pauses with it.

## Fix

1. Remove the repeating whole-scene asynchronous shader warmup that causes the crash and recurring workload. Keep normal renderer compilation and existing staged loading.
2. Give the active writing line a fast visual path: show each selected symbol immediately using the existing font, colour, alignment, wrapping, and size, then replace it with the saved full 3D treatment after a short idle period.
3. Keep inactive and settled lines exactly as designed, including 3D text, tiles, surfaces, rewards, positions, and Edit-to-Play parity.
4. Prevent live line text from causing unrelated surfaces and reward objects to rebuild where references have not changed.
5. Preserve the single Game clock, Floating Numbers mathematics, AI marking, reward behavior, persistence, and Reset semantics.

## Verification

- Reproduce rapid symbol entry in Play and confirm every symbol appears immediately and in order.
- Confirm TIME and line timers continue advancing during rapid entry and marking.
- Confirm direct surface taps instantly activate the corresponding Floating Numbers line.
- Confirm AI completion and all rewards still activate correctly.
- Leave the Game running through staged artwork and lighting loads and verify there is no `isReady` error, blank surface, pause, or input seizure.
- Test desktop and phone viewports, then run the focused Game/Slate tests and type checks provided by the workspace harness.
