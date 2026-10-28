# Imagine Energy Ball replacement

Remove **Math Core / Bomb** and **Premium Spherical Chain Bomb** from **Imagine only**. The original 3D Game and its reward catalogue remain unchanged.

## What changes
- The Imagine reward picker will no longer offer either bomb.
- Any existing Imagine placement of either bomb will appear and behave as an **Energy Ball**, including older saved activities and assigned/student play.
- New Imagine activities will offer one Energy Ball choice rather than the two bombs.
- The Energy Ball stays at its earned position and spins rapidly with a west↔east orbital/yaw motion, not a flat wheel rotation.
- On activation it emits one collector-shaped projectile for every eligible reward currently visible in the viewport.
- Each projectile points directly at its own target, travels in a straight line, hits it, and activates that reward through its normal behaviour.

## Exact eligibility rule
Every visible, dormant reward is eligible except:
1. **Hourglass Timer**
2. **Completion Coin**

The Vault, Life, Horizontal Collector, Vertical Collector, Calculator Trophy, another Energy Ball, and all other rewards remain valid targets. Hidden, consumed, already-active, off-screen, and already-visited rewards are skipped.

Only the visible lines matter. If a 50-line activity currently shows lines 1–4, projectiles target rewards on those visible lines only.