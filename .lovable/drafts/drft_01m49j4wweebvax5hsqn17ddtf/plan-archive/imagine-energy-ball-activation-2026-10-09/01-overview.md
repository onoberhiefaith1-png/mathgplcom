# Imagine Energy Ball activation

Correct the Energy Ball's activation rules in **Imagine only**. The original 3D Game stays unchanged.

## Student experience
- When the Energy Ball activates, it emits visible projectiles that travel to the eligible rewards currently on screen.
- Each reward a projectile reaches activates through its normal behaviour; bombs and collectors can continue the chain.
- Writing, Floating Numbers, marking, scrolling and line progression remain available throughout the effect.

## Activation rules (corrected)
The Energy Ball activates **every eligible reward** on screen, with exactly two exclusions:

1. **Hourglass Timer** — never activated.
2. **Completion Coin** — never activated.

Everything else is a valid target, including the **Vault**, Life, both Collectors, both Bombs, the Calculator Trophy, and any other reward on screen. Hidden, consumed, already-active and off-screen rewards are still skipped, and each reward fires at most once per chain.
