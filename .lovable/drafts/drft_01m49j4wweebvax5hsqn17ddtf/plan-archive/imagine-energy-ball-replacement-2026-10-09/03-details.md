## Implementation details

### Imagine-only replacement
- Filter Math Core and Premium Spherical Chain Bomb out of Imagine’s reward picker without changing the shared 3D Game registry.
- Add an Imagine normalization helper that maps both legacy bomb types to `imagine-energy-ball` while preserving each placement’s ID, line, position, size, state, and other saved properties.
- Apply that mapping at every Imagine boundary that renders or edits shared Game data, including normal play, assigned play, Academia play, guest play, editor previews, and previously saved activities.
- Save the converted reward type when an owner next edits/saves an Imagine activity; student play remains read-safe and does not rewrite the teacher’s activity.

### Orbital activation
- Replace the current flat Energy Ball wheel rotation with a fast spherical yaw/orbit: west→east→west shell motion plus a counter-moving halo, using transform and opacity only.
- Keep the source ball at its earned on-screen position throughout charging and emission.
- Respect reduced-motion with a short charge and immediate straight projectiles.

### Collector projectiles
- Build the target list from actual rendered reward rectangles, so only rewards intersecting the current viewport are included.
- Emit exactly one projectile per eligible target, with bounded concurrency so a crowded screen remains responsive.
- Choose the existing **Horizontal Collector** artwork for mostly sideways routes and **Vertical Collector** artwork for mostly vertical routes.
- Rotate each artwork to its true source→target angle, then translate it in a straight line to the target. No new missile artwork or lightning substitute.
- Activate the target on impact through the existing consume/event path. A struck collector, Energy Ball, Vault, or other reward then performs its own normal behaviour.
- Keep one visited set per chain to prevent duplicate hits and loops.

### Verification
- Tests prove that legacy Math Core and Premium Bomb placements normalize to Energy Ball only in Imagine, while original Game data remains unchanged.
- Tests prove the target rule excludes exactly Hourglass and Completion and skips off-screen/hidden/active/visited rewards.
- Tests prove one target produces one projectile, artwork matches route direction, and its angle/endpoint reaches the target.
- Browser checks cover editor picker removal, an older saved Imagine activity, 1–4 visible lines within a longer activity, multiple angled projectiles, Vault activation, chain termination, reduced motion, and uninterrupted writing/marking.