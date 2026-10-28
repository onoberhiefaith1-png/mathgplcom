# Reward Conversion

A new **Reward Conversion** section appears in the Game editor, directly under the existing Rewards section (not inside the Hourglass controls). It defines how earned rewards turn into Life and Time. Every existing reward keeps behaving exactly as it does today; conversion is a layer on top.

## The four settings

| Conversion | Range | Default |
| --- | --- | --- |
| Hourglass → Time | 0.1× – 10× | 1× |
| Life → Time | 0.1× – 10× | 1× |
| Vault/Bot → Life | 0.1× – 10× | 0.1× |
| Completion Coin → Life | 0.1× – 10× | 0.1× |

Bomb, Horizontal Collector, Vertical Collector and other activation-only effects are not listed and never convert into Life or Time, and never count toward the Vault or Completion totals.

## How each one behaves in play

**Hourglass → Time.** An Hourglass earned in time is consumed and adds time as it does today, multiplied by this factor (Game time 2 min at 2× adds 4 min).

**Life → Time.** Earning a Life only stores a Life; it adds no time at the moment it is earned. When the Game time expires, one Life is consumed and Life × total Game time is added, then play continues under the existing rules. This replaces today's behaviour where a Life quietly added time the instant it was collected.

**Vault/Bot → Life** and **Completion Coin → Life.** Automatic and instant. Each unit earned adds `unit × factor` toward Life. Whole Lives are granted immediately as soon as the running total crosses 1, and the leftover fraction is kept, so at 0.1× the tenth Vault/Coin produces a Life. Vault and Completion Coin totals still show in the HUD exactly as now; the conversion is additional.

## Technical notes

- `GameSettings` gains `conversion: { hourglassToTime, lifeToTime, vaultToLife, completionToLife }`, clamped 0.1–10 with the defaults above. `storage.ts` normalises it on load, migrating the existing `settings.life.multiplier` into `lifeToTime` so saved Games keep their current Life value.
- The existing per-line Hourglass multiplier stays untouched; the new Hourglass → Time factor multiplies the seconds that line already produces.
- `useGameRuntime.ts`:
  - remove the instant `secondsGain` grant for Life in `consumeLine` and `consumeWorldReward`; Life is stored only.
  - the time-expiry path keeps consuming one Life and now uses `lifeToTime` for the seconds granted.
  - Hourglass payout multiplied by `hourglassToTime`.
  - add fractional accumulators (refs, persisted with progress) that convert Vault and Completion gains to Life instantly as thresholds are crossed; runs on every Vault open (`openVaultOnly`) and every authoritative completion coin, never for Bomb/Collector effects.
  - Reset clears the accumulators along with the rest of the run; teacher settings are untouched.
- `ControlPanel.tsx` gains a `Reward Conversion` section under `Rewards` with four number inputs. The existing Life-time field in the Questions panel reads and writes the same `lifeToTime` value so the two never disagree.
- Tests: conversion clamping/migration, Life grants no time on collection, Life at expiry grants `factor × game time`, ten Vault units at 0.1× produce exactly one Life with no leftover drift, Bomb/Collector produce no Life, and Vault opening still awards no line mark.
