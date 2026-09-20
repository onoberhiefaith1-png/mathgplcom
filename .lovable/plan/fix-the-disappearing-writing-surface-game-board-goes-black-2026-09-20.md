# Fix the disappearing writing surface (Game board goes black)

## What is happening

The Game board's 3D view is dying, not being deleted. Your board settings, surfaces and rewards are still saved — the picture simply stops being drawn, leaving a black area where the writing surfaces were.

The browser log from your session confirms it: the graphics view for the Game board reported "context lost" repeatedly (four times in about a minute). When that happens the picture is gone until the page is reloaded.

Every other 3D screen in the app (homepage building, adventure portal, model viewer, building archive) already has a recovery routine that catches this loss and brings the picture back automatically. The Game board is the only 3D screen that was never given it, so it is the only one that goes permanently black.

## The fix

1. Give the Game board the same recovery routine the other 3D screens use:
   - block the browser's default teardown so the same view can be restored,
   - when the browser restores it, resume drawing with no reload,
   - if the browser never restores it within a few seconds, rebuild the view once (never in a loop).
2. Keep the last picture and your settings panel fully usable while it recovers, instead of showing a black hole. Show a short, quiet "restoring the board" note so it is obvious the board is coming back rather than broken.
3. Reduce the chance of the loss in the first place: the board keeps the view even when the background image/video and textures change, so heavy uploads swap inside the live view rather than forcing a rebuild.
4. Make the existing error boundary around the board report a recoverable graphics loss as recoverable, with a Reload board action, so a genuinely unrecoverable failure still never leaves a silent black screen.
5. Fix the stray `v is not defined` script error reported by the preview, so it cannot contribute to a dead frame.

## Verification

- Load the Game board, deliberately trigger a graphics-context loss in the live page, and confirm the writing surfaces reappear on their own without a reload and without losing unsaved panel state.
- Confirm the board survives changing the background and switching surface materials repeatedly.
- Confirm Game Play is covered by the same recovery, not just Edit.
- Re-run the Game/slate test suite and the type check.

## Technical detail

- `src/components/gameslate/world/WorldStage.tsx` is the only `<Canvas>` in the app with no `useWebglRecovery` (`src/lib/stability/useWebglRecovery.ts`). Wire `attach(gl.domElement)` in `onCreated`, key the canvas on `resetKey`, and use `alive` to gate the overlay message.
- `WorldBoundary.tsx` gets a recoverable branch plus a retry that clears the captured error.
- Both `/game/slate/$gameId` (Edit) and `/game/play/$gameId` render `WorldStage`, so one change covers both.
