# Keep the homepage building permanently visible

## Confirmed diagnosis

- The affected homepage attempted to load a signed custom-building `.webm`, and the browser reported `MEDIA_ELEMENT_ERROR: Format error` for that asset.
- The custom-building branch has no media-error handoff to the original MathGPL building. A failed signed URL or unplayable file can therefore leave only the background visible.
- The original 3D branch is also hidden until configuration, texture paint, artwork readiness and GPU readiness all succeed. Failed texture loads are silently discarded, so the opacity gate can remain closed indefinitely.
- WebGL context loss currently hides the entire canvas immediately and may remount it after three seconds, restarting the same loading gates.
- Shipped MathGPL slot artwork already exists locally and is the correct reliable fallback; this repair does not require a database or content-model change.

## Repair

1. **Make the original MathGPL building the permanent visibility floor**
   - Keep the canvas mounted with the shipped MathGPL artwork while account/workspace configuration resolves.
   - Remove indefinite opacity gating: reveal the scene after its first frame, with a bounded readiness timeout if artwork callbacks never arrive.
   - Preserve loaded artwork during later configuration refreshes instead of blanking the scene.

2. **Fail custom media back to MathGPL automatically**
   - Add explicit load/error reporting to the signed-media and chroma-video paths used by the custom building.
   - If a signed URL cannot resolve, a video format cannot play, frame extraction fails, or loading exceeds a short grace period, replace only that failed custom visual with the original MathGPL building.
   - Keep the saved custom selection intact so a temporary network failure does not erase the user’s choice; retry it on the next normal load.

3. **Harden signed media and transparent-video playback**
   - Start playback from a directly playable signed URL rather than making CORS blob conversion a prerequisite.
   - Use blob/frame processing only when transparency processing needs it, with cancellation and object-URL cleanup.
   - Propagate video, image, canvas and signing failures instead of leaving an endless loading placeholder.

4. **Make texture and configuration failures recover safely**
   - Ensure homepage configuration always settles to shipped defaults after request errors.
   - Retry failed signed URLs/textures once with a fresh URL; after that, substitute the corresponding shipped slot artwork.
   - Keep individual segment failures from creating permanent holes in the building.

5. **Stabilize WebGL recovery**
   - Keep the last visible scene during recoverable context loss instead of immediately fading the building out.
   - Bound fallback remounting so context-loss events cannot create a remount loop.

## Validation

- Load the homepage with the currently broken `.webm`: the original MathGPL building must appear instead of an empty sky.
- Verify valid custom image, transparent image and playable video buildings still render and switch correctly.
- Simulate signing failure, texture failure, media format failure, slow configuration and WebGL context loss; every case must retain or recover to a visible building.
- Capture timed desktop and mobile screenshots over at least ten seconds and confirm the building never disappears.
- Confirm no WebGL context-loss loop, unhandled media error, missing canvas, or permanent loading placeholder appears in browser logs.

## Scope

Frontend rendering and media resilience only. No stored building choice will be deleted or rewritten, and no database schema change is required.
