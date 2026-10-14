## Technical details
The completion character currently renders at layer 36 while actions render at layer 42. Change only the Game character's stacking order; retain non-interactive playback and the existing Flow wrapper. Do not alter the shared original Flow controls.

Store the owner-permission requirement in project memory and scoped architecture rules. Add a lightweight baseline comparison for protected Game files and reviewed shared dependencies; update that baseline only after owner-authorized changes. This detects changes rather than making software physically immutable.

## Verification before locking
1. Reach a completion or paused screen in the real signed-in Game with the animation overlapping Exit Game.
2. Verify the animation paints in front and tapping the overlapped button still exits correctly.
3. Check phone, tablet and desktop layouts, saved placement, and no drag/size controls during play.
4. Run relevant Game regression tests and check preview errors; preserve reward-presentation protections unchanged.
5. Verify the baseline check detects a proposed protected-code change without modifying protected files.

Report installed-offline or real-device checks as unverified if they cannot be exercised here.
