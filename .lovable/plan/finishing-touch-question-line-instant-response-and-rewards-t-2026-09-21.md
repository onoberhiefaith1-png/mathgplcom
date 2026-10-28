# Finishing touch — question line, instant response, and rewards that obey their own rules

Goal: the Game behaves exactly like the Smartboard split into lines, and every reward activates only on its real condition, then leaves for good until Reset.

## What is already correct (confirmed)

- Surface 0 shows the attached question text and is read-only; solving starts at Surface 1, and each surface maps to its Floating Numbers line by line id.
- Marking already runs proactively on the active line only (60 ms coalescing, server is the final judge), and a completed line pays its line rewards once.
- Vault codes already compare an ordered, consecutive token sequence against the student's own working on that line, so a scattered match cannot open one.
- Completion coin already rises by one per completed line.

## What will change

### 1. Nothing is activated by tapping it

A tap on any reward in Play will only select that reward's writing line and focus the input. Rewards will never fire from a student or teacher tap. Test activation stays available only in the Game editor's own test mode.

### 2. Vault

- Opens only when its encrypted code appears, in order and unbroken, in that line's working.
- One-time: once open it is gone, and nothing else (bomb, collector, completion) can open it.
- The top strip will show opened vaults against the total number of vaults in the question, e.g. `VAULTS 2/5`, alongside the reward value it has paid.

### 3. Completion coin

Rises the moment the line is marked correct. It is never triggered by a bomb, a collector or a tap.

### 4. Collectors (vertical and horizontal)

- Travel from their own position to both screen boundaries along their single axis.
- Activate everything they pass: bombs, hearts, other collectors — chaining onward.
- Never touch the Hourglass, the Completion coin or a Vault. Those three answer only to the student's own solving.

### 5. Hourglass

- Starts counting only after the first two mathematical entries land on its own line.
- Only the line the student is actually writing on counts down. Jumping to another line leaves that line's hourglass untouched, exactly where it was.
- Reaching zero: it dissolves permanently for this run, with no penalty, and returns only on Reset.
- Solving the line before it empties awards time: the line's own time multiplied by the teacher's Hourglass setting.
- The Hourglass setting becomes a number from 0.1 to 10 (default 1). 1 awards the same time, 2 awards double, 0.5 awards half. The existing four fixed choices are replaced by this scale, and saved Games keep their current value.

### 6. Life (heart)

- Awarded on completing its line, or when a bomb, a collector or another life reaches it.
- Its value is the teacher's Life setting, 0.1 to 10 of the total question time, default 1 (the same time again). Collecting a life adds that time immediately and raises the heart count.
- Once collected it disappears and does not come back until Reset.

### 7. Top strip and Reset

The strip shows question time, line time, hearts, completion coins and opened vaults out of total. Reset returns every reward, hourglass, coin, heart and vault to its starting state and clears the student's working, leaving the teacher's saved design untouched.

## Technical notes

- `src/lib/slate/rewards.ts`: protection narrows to `mark-seal`, `time-shard`, `math-vault`; `math-core` and `premium-chain-bomb` become world-interaction eligible so collectors chain through them.
- `src/components/gameslate/world/SlateColumn.tsx`: remove the unconditional `onActivate` on reward click in non-editable mode (keep line selection on pointer down); move the hourglass countdown off per-object mount onto the runtime's engaged-line deadline; keep the sand/label reading from that single clock.
- `src/hooks/useGameRuntime.ts`: hourglass start gated on two or more tokens on its own line; expired hourglasses recorded in persisted consumed keys so they stay gone; `vaultsOpened`/`vaultsTotal` exposed separately from the vault reward value; life collection adds `lifeSeconds(...)` to the question deadline.
- `src/lib/slate/lineSurfaces.ts` / `types.ts`: `hourglassReward` becomes a clamped 0.1–10 multiplier (`hourglassMultiplier`), with the old `TimeFraction` values read as their numeric equivalents; `QuestionsPanel` and `ControlPanel` switch to the numeric input already used for Life.
- `src/pages/game/GamePlayPage.tsx`: HUD gains vault count out of total; collector sweeps use the world boundary rather than a fixed reach.
- Tests: pattern/lineSurfaces/runtime suites extended for tap-does-not-activate, collector chain excluding hourglass/completion/vault, per-line hourglass isolation and permanent expiry, multiplier maths, and one-time vault.

## Verification

Live play on desktop and phone: question on Surface 0, writing from Surface 1, instant marks as on the Smartboard, taps on rewards doing nothing but selecting a line, a vault opening on its exact code and counting up, a collector sweeping both boundaries and chaining bombs and hearts while leaving hourglass/completion/vault alone, an hourglass counting only on its own engaged line and vanishing at zero, time awarded when the line is solved in time, a life adding its configured time, and Reset restoring everything.
