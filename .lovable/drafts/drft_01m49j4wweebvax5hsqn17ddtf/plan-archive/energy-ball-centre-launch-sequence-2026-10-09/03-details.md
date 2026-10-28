## Implementation details

### Correct the launch origin
- The current Imagine effect already chooses Collector artwork by route direction and calculates the target angle, but it launches from the Energy Ball's original reward position.
- Change the sequence so the ball first translates to the viewport centre; only after it arrives do all missile paths use that centre point as their source.
- Keep the ball centred and visibly orbiting while missiles launch, then remove it after the final impact.

### Collector missiles
- Continue using only the existing Horizontal and Vertical Collector images—no new missile artwork.
- Choose the closest natural artwork orientation for each route, then rotate that image to the exact `atan2` angle from screen centre to target.
- Launch in stable visible order with short staggering and bounded concurrent animation. Each impact calls the existing activation path, preserving Vault reveal, Life, Collectors, Calculator, another Energy Ball, and reward chains.
- Keep the exact exclusion rule: Hourglass and Completion only. Skip hidden, consumed, already-active, off-screen, source, or already-visited rewards.

### Lightweight boundary
- Use the existing pointer-free DOM/CSS reward layer with transforms and opacity only; no 3D, physics, canvas, blur, or board re-render.
- Capture visible target positions at activation so scrolling or writing never waits for the animation.
- Respect reduced-motion by centring quickly and shortening missile travel while preserving every activation.

## Verification
- Unit tests confirm centre-origin geometry in every quadrant, exact Collector rotation, one missile per eligible target, and the two exclusions.
- Chain tests confirm each reward activates once and loops terminate.
- Browser checks confirm: the ball visibly moves to centre before firing; diagonal Collector copies point toward and hit their targets; Vault activates; Hourglass and Completion do not; controls and writing remain responsive on desktop and phone.
- Confirm the original 3D Game remains unchanged.
