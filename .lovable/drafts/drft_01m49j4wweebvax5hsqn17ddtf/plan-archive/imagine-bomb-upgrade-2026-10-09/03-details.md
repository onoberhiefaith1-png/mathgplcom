## Implementation details

### Shared bomb choreography
- Give `math-core` and `premium-chain-bomb` one Imagine-only activation profile: rapid horizontal yaw/orbit from west to east and back, no north-to-south wheel rotation.
- Add lightweight SVG lightning bolts and impact flashes. Bolt paths are created once per activation and animated with transforms/opacity only.
- Reuse the existing bomb sound settings and keep every cue fire-and-forget.

### Deterministic activation rules
- Extract a pure Imagine chain-target resolver from the current shared reward eligibility rules.
- Resolve targets from the rewards actually rendered in the visible Imagine stage, in stable screen order; never choose randomly.
- Eligible targets include Life, both collectors, other bombs, Energy Ball, Calculator Trophy, and every other world-interaction reward.
- Exclude Hourglass, Vault and Completion; also skip the source, hidden, consumed, active and off-screen rewards.
- Mark each activation in a chain so cycles such as bomb → collector → bomb cannot fire the same reward twice.
- Route every impact through the existing consume/activate callbacks so scoring, persistence and reward-specific behaviour remain authoritative.

### Performance boundary
- No Three.js, WebGL, physics, shader or 3D Game imports enter Imagine.
- Keep a small cap on concurrent bolts and queue additional impacts in short batches.
- Use `pointer-events: none`, transform/opacity animation, and a reduced-motion fallback; gameplay state updates immediately and never wait for animation completion.

## Verification
- Add focused tests proving both bomb types produce the same ordered targets and timing rules.
- Assert Life, horizontal/vertical collectors, another bomb, Energy Ball and Calculator are eligible.
- Assert Hourglass, Vault and Completion are never selected; assert hidden, consumed, active, off-screen and duplicate targets are skipped.
- Test a cyclic chain to prove each reward fires once and the chain terminates.
- In Imagine play, activate each bomb on desktop and phone; confirm horizontal orbit, lightning landing on the correct visible icons, chained reward behaviour, uninterrupted typing/marking, sound/mute, and reduced motion.
- Confirm the original Game is unchanged.
