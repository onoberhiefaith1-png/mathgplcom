## Implementation details

### Energy Ball eligibility
- Add an Energy-Ball-specific eligibility rule: every reward type is eligible except `time-shard` (Hourglass) and `mark-seal` (Completion). Unlike bombs and collectors, the Vault (`math-vault`) **is** a valid Energy Ball target.
- Keep the shared Game gate untouched: bombs and collectors continue to protect Hourglass, Completion and Vault exactly as they do today.

### Activation behaviour
- On activation, the Energy Ball charges briefly, then emits lightweight DOM/SVG projectiles toward each eligible visible reward in stable screen order — never random.
- Each impact routes through the existing consume/activate callbacks, so scoring, persistence and reward-specific behaviour (Vault reveal, bomb chains, collector sweeps) remain authoritative.
- A per-chain visited set guarantees each reward fires once and cyclic chains terminate.

### Performance boundary
- No Three.js, WebGL or 3D Game imports enter Imagine; projectiles are transform/opacity animations on a pointer-free overlay.
- Bounded concurrent projectiles, reduced-motion fallback, and gameplay state updates immediately without waiting for animation.

## Verification
- Pure tests: Energy Ball targets include Vault, Life, both collectors, both bombs and Calculator; Hourglass and Completion are never selected; hidden/consumed/active/off-screen/duplicate targets are skipped.
- Chain test: Energy Ball → bomb → collector terminates with one activation per reward.
- In Imagine play, activate an Energy Ball with a Vault and a bomb on screen; confirm the Vault opens, the bomb chains, and Hourglass/Completion stay untouched.
- Confirm the original Game is unchanged.
