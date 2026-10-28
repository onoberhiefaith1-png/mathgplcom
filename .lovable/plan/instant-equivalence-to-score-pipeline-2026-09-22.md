# Instant equivalence-to-score pipeline

## Objective
The final valid Floating Number placement must produce one indivisible result:

```text
CURRENT LINE INPUT
      ↓
PROVED EQUIVALENT
      ↓ same action
MARK RECORDED + SCORE UPDATED + COMPLETION EVENT
      ↓
GAME HUD / GAME EVALUATION / NOTE / REWARDS UPDATE
```

There will be no normal “Equivalent detected / Score pending” state. A line that has not been proved equivalent receives no mark.

## Confirmed issue
- The Game Evaluation panel calculates equivalence from the newest visible Game-line text.
- The score-award path separately calls `resolveGradableLine`, which can still return an empty or older board value during Game test play.
- Therefore the inspector can show **Equivalent detected** while the award event never reaches the Game runtime, leaving **0/6**.
- The existing 1.5-second grace period only reports this split; it does not repair it.
- Vault activation remains separate and does not enter this marking path.

## Implementation

### 1. Establish one authoritative current-line snapshot
- Capture the exact active line ID, exact student expression, and input revision from the same Floating Number placement event.
- Use that immutable snapshot for prediction, proof, marking, score, and the Game handoff.
- Remove the award path’s dependency on re-reading potentially stale board layout state after the placement.
- Reject stale proofs whose question, line, expression, or revision no longer matches the current snapshot.

### 2. Make proof and award atomic
- Refactor the existing predictive completion path into one idempotent `proveAndAwardCurrentLine(snapshot)` transaction.
- Only a locally proven result or a previously authoritative pre-clearance certificate may enter the award branch.
- In that same synchronous state update, record the solved line, add its marks once, confirm its timer, and publish the exact awarded expression.
- Emit one award event containing question ID, line ID, expression, marks, and proof source; duplicate calls become no-ops.

### 3. Keep the engine ahead of the student
- Build/cache the route information when the active question, line, or Floating Numbers change.
- For student assessments where the answer stays server-side, request authoritative pre-clearance while the route is still incomplete and cache it against the exact line and expression.
- Recalculate only the affected current line when the student changes direction.
- The final placement consumes an already-valid proof; the normal marking request continues only as background reconciliation, never as the first award path.

### 4. Use the atomic award everywhere
- Smartboard score and Game score consume the same solved-line award state.
- The Game runtime accepts the event only when its exact awarded expression equals the current line snapshot, then updates `0/6 → 2/6`, completion, note, and eligible rewards together.
- Game Evaluation derives **Equivalent / Awarded** from that same event instead of independently announcing equivalence first.
- Remove the normal pending display and grace timer. Retain a developer-only fault signal if a proved award event is ever rejected, without showing “pending” to the student.

### 5. Preserve strict separation
- Vault exact-sequence matching stays unchanged and can activate on an incomplete line without marks.
- Hourglass, Life, Bomb, Collectors, Completion Coin, notes, and rewards do not prove mathematics.
- Notes and completion rewards remain locked until the atomic mathematical award is accepted.
- Existing Smartboard Evaluation and Assignment/Student Dashboard screens remain visually unchanged.

## Verification
- Regression test: final Floating Number changes a 2-mark line from incomplete to equivalent and the score changes from `0/6` to `2/6` in the same input cycle.
- Regression test: equivalent reordered equations award instantly when the available Floating Numbers permit them.
- Regression test: incomplete/non-equivalent expressions, including `x + 7`, award zero and reveal no note.
- Regression test: a Vault coded `x + 7` opens without changing the score for target `x + 7 = 12`.
- Regression test: stale line/expression/revision events cannot award, and duplicate events cannot award twice.
- Live-check the saved room Game with Floating Number taps on desktop and phone; confirm no visible pending state, immediate HUD score, immediate Game Evaluation award, note/reward gating, and correct line switching.
- Verify the same instant score path on the platform Smartboard without changing its interface.
