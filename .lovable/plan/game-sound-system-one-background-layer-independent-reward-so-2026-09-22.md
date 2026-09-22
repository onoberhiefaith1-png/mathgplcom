# Game Sound System — one background layer, independent reward sounds

Two completely separate sound systems, plus organised galleries by purpose.

## 1. Game Background Sound

A new **Game Sound** section inside Game Settings:

- Choose a sound (from the official Game Sound Gallery or your own upload)
- Preview it before selecting
- Its own volume
- On / off switch

Behaviour: it starts when the Game starts and keeps playing for the whole session. Changing Line 1 → 2 → 3 never restarts or reloads it. One persistent playback instance, its own volume, untouched by rewards.

## 2. Reward Sounds

Every reward type gets its own sound and its own volume: Vault, Bomb, Life, Hourglass, Horizontal Collector, Vertical Collector, Completion Coin (and any reward added later).

Trigger rule: a sound plays only at the exact moment that reward's activation state changes. A reward sitting on the line, loading, becoming visible, the Game starting, or the student entering the line all stay silent. Several rewards activating together play their sounds together, over the background sound, each at its own volume.

Where nothing has been selected for a reward, the Game keeps the short built-in cue it already plays today, so no Game goes silent.

## 3. Official Sound Gallery (administrator only)

Added to the existing official asset library, so it is the platform's permanent sound library:

- Upload one sound or many at once
- Add more at any time
- List, rename, preview, reorder, hide
- Only administrators can add to it; every teacher can select from it

Organised into separate galleries by purpose: Game Sound, Vault, Bomb, Life, Hourglass, Collector, Completion Coin. The Game Sound selector only sees Game Sounds; the Vault selector only sees Vault sounds, and so on — never one long mixed list.

## 4. A teacher's own upload

Every selector also offers **Upload My Sound**. That file is saved with that teacher's own Game, is usable in their Game only, and is never added to the official gallery or shown to other teachers. A newly uploaded sound is never selected automatically — the teacher chooses it.

Once chosen, each slot shows: sound name, Preview, volume, Selected ✓.

## 5. Performance and separation

Selected sounds are prepared ahead of play. Audio is never rebuilt when a line changes and the background never reloads when a reward fires. Reward sounds are lightweight one-shots. Nothing in the audio layer can pause, delay or block Floating Numbers, typing, marking, predictive evaluation, rewards, timers, line changes or Game progress. Mathematics, rewards and audio stay separate systems.

## Technical notes

- **Storage**: official sounds reuse `gpl_assets` (`asset_type: "audio"`) under new purpose folders; a migration adds the Sound Gallery session and its per-purpose sub-sessions. Teacher uploads reuse the owner-scoped `game-assets` bucket through `putAsset`, and the Game stores only the object path.
- **Config**: new `GameSettings.sound` = `{ background: { ref, volume, enabled }, rewards: Record<RewardSoundKey, { ref, volume }> }`, where `ref` records source (official / own upload), path, title. Saved and loaded with the Game; defaults are silence, so existing saved Games keep working.
- **Engine**: new `src/lib/slate/gameSound.ts` — one keyed persistent element for background (a re-render with the same source is a no-op) and a separate one-shot pool for reward events, both behind the existing gesture-unlock latch, with independent gain per slot. No Web Audio graph rebuilds per line.
- **Triggers**: reward sounds are fired from the existing activation transitions (`useGameRuntime` consumed/armed changes and the current cue points in `Effects.tsx` / `EffectsPremium.tsx` / `SlateColumn.tsx`) — the same places that already mark an activation, so no new reward logic and no second event source.
- **UI**: Game Sound section in `ControlPanel.tsx`; a compact sound row per reward type in the existing reward configuration, sharing one `SoundPicker` (Gallery | Upload My Sound, preview, volume). Admin management extends the existing official-asset manager with audio preview.
- Untouched: mathematics, grading, predictive evaluation, Vault exact-sequence behaviour, reward conversion, rooms, camera, layout, Smartboard and Assignment evaluation.
