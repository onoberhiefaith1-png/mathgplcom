# Plan: Upgrade Game Reward Audio Only

## Goal
Upgrade only the Game reward/effect sounds with a premium built-in library. The existing Game Background Sound system stays untouched.

## What will change
1. **Add 12 built-in reward sounds**
   - Bomb: 2 different premium impact/explosion sounds.
   - Vault: 2 different magical unlock/reveal sounds.
   - Life: 2 different warm reward/energy sounds.
   - Hourglass: 2 different time/magic activation sounds.
   - Completion Coin: 2 different coin/achievement sounds.
   - Collector: 2 different fast collection/sweep sounds.

2. **Keep reward sounds short and instant**
   - Built-in sounds will be concise game-effect sounds, not music.
   - Each option will be meaningfully different in rhythm, layers, envelope, and texture, not just pitch or volume changes.

3. **Add built-in options to the existing Reward Sounds picker**
   - Each reward sound picker will show the two premium built-in options.
   - Each option can be previewed before selecting.
   - Selecting a built-in option will save it like the current chosen reward sound.
   - Existing independent volume controls remain per reward type.

4. **Preserve Upload My Sound**
   - Teachers can still upload their own sound.
   - Uploaded sounds remain selectable instead of built-in options.
   - Official gallery/admin uploads remain intact.

5. **Preserve the existing event system**
   - Reward sitting on the Game Line stays silent.
   - Sound plays only when that reward activates/is awarded.
   - No sound plays when the line opens, reward loads, or player enters the line.
   - Multiple simultaneous reward activations can play together.
   - Reward audio never blocks typing, marking, timers, progress, or gameplay.

## What will not change
- No changes to Game Background Sound.
- No changes to background music playback, volume, saving, or picker behavior.
- No changes to mathematics, grading, Vault matching, reward activation rules, line completion, timers, or Game Slate layout.

## Technical details
- Add a reward-only built-in sound library alongside the existing reward sound system.
- Extend saved reward sound references to support built-in sounds safely, while preserving older official/user sound choices.
- Route preview/playback through the current non-blocking one-shot reward audio path.
- Keep background preparation/playback paths unchanged.
- Add focused tests for:
  - two built-in choices per reward type,
  - reward-only selection persistence,
  - background sound untouched,
  - built-in reward playback resolves without storage/network dependency,
  - event-triggered playback remains one-shot and non-blocking.

## Verification
- Confirm each reward type shows exactly two built-in premium choices.
- Preview every built-in option from the picker.
- Confirm Upload My Sound still works in the same picker.
- Confirm reward activation plays sound immediately.
- Confirm entering a line, loading a reward, or opening a line stays silent.
- Confirm background music continues underneath and is not modified.
