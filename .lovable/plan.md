# Fix “Only on solution” Trail deactivation cleanup

## Goal
Keep the hashtag toggle, Trail appearance, movement, timing, positioning, and reactivation behavior unchanged. On the second hashtag click, remove every Trail pixel and Trail-rendering element from the Smartboard.

## Confirmed cause area
- The hashtag already toggles Floating Numbers and sends `HASH_ON` / `HASH_OFF` into the existing Flow state machine.
- `HASH_OFF` correctly leaves sensor mode, but the Trail canvas remains mounted after sensor mode ends and relies only on effect cleanup to erase its final painted frame.
- This allows the browser’s last composited canvas frame to remain visible even though Trail animation has stopped.

## Implementation
1. Make Trail lifetime follow sensor-mode lifetime: mount the Trail renderer only while sensor mode is active, so deactivation removes the canvas itself rather than leaving an inactive rendered surface behind.
2. Strengthen Trail teardown to cancel its animation frame, clear the complete backing canvas with an identity transform, and reset drawing state before disposal.
3. Preserve the existing Flow state machine and hashtag behavior, including Flow Out, Flow In, character playback, Trail styling, placement, and timing.
4. Add focused regression coverage for the `HASH_ON → sensor → HASH_OFF` cycle and Trail teardown/reactivation behavior.

## Verification
- Run the focused Flow tests and project type checks.
- Open the existing Smartboard with Flow enabled.
- Click hashtag once and confirm the Trail appears normally.
- Click hashtag again and confirm the full Trail, including its final segment and canvas, disappears.
- Click hashtag a third time and confirm the unchanged Trail activates correctly again.
- Check the Smartboard at the supplied desktop viewport for residual pixels, overlays, runtime errors, and build errors.
