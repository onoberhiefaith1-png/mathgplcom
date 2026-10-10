## Technical details
- `GameCompletionScene`: reward rows render only the animated target value; read `flow.position` (character x/y/scale and `emotionBar`) in both preview and play; `editable` only when `creatorControls`.
- Settings toggle: add a switch in the Imagine editor settings bound to `settings.completionFlow.enabled` (same field as the Flow page switch).
- Smooth loop: in `FlowCharacter`, when looping the base scene seek ahead of the end (~0.1s) instead of pause/restart, keep the last frame drawn during seek, and preload clips by mounting the scene's videos when the question starts.
- `useGameRuntime`: on timer expiry with lives > 0 deduct one life and reset the timer (verify existing behaviour, fix if missing); with 0 lives set `completion.failed` -> outcome "failed" with "Time Up!" title. Leave/Exit mid-question shows outcome "left" with its scene before leaving.
- Add tests for the outcome rules (life used vs Time Up) in the existing gameCompletion tests; verify with Playwright on desktop and phone.
