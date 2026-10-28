## Implementation details

### Round bomb presentation
- Keep each bomb’s existing artwork and identity, but present it inside a fixed square, circular silhouette with no stretching.
- Replace the current fly-to-centre enlargement with an in-place sequence: short anticipation, rapid west↔east spherical yaw, rotating inner/orbital layer, controlled glow, lightning discharge, then disappearance.
- Use only composited DOM/CSS transforms and opacity. No Three.js, canvas, shader, blur-heavy filter or generated video enters Imagine.
- Keep both bombs on one timing and activation contract while preserving their own colour and artwork.

### Full collector sweeps
- Replace the current small 14-pixel wiggle with measured viewport travel.
- Horizontal Collector travels along the x-axis; Vertical Collector travels along the y-axis. Each starts toward its nearest edge, sweeps once across the complete visible play area, and exits at the far edge—matching the original Game.
- Add a narrow energy trail and brief contact flash behind the collector using one lightweight overlay element, not particles per frame.
- Determine touched rewards from their real screen rectangles. Sort them by distance along the sweep, so each activates at the moment of contact.
- Route each contact through the existing reward activation/consume path. A touched bomb or collector can continue the chain; a visited set prevents loops and duplicate activations.

### Safety and performance
- Reuse the shared eligibility gate so Completion, Hourglass and Vault are never touched.
- Bound every chain, trail and flash queue; clean timers when the overlay unmounts; shorten effects for reduced-motion or low-capability devices.
- Keep the overlay pointer-free and independent from writing surfaces. Gameplay updates immediately and never wait for an animation or sound.
- Use existing sound settings: charge, sweep, contact and exit cues are fire-and-forget and respect mute/volume.

## Verification
- Add pure tests for horizontal and vertical path selection, contact order, off-path skips, protected rewards, hidden/consumed/active skips and cycle termination.
- Verify both bombs remain circular at phone, tablet and desktop sizes and never stretch while rotating.
- In Imagine play, trigger each bomb and collector with several visible rewards, including another bomb and collector; confirm exact contact order and one activation per reward.
- Confirm Horizontal sweeps left–right and Vertical sweeps up–down, both disappear after the pass, and writing/marking remain usable throughout.
- Confirm the original 3D Game files and behaviour are unchanged.
