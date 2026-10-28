# Default offline Game background

## Goal
Use the uploaded castle image as the standard fallback background for every MathGPL Game. Preserve each creator’s original background and show it automatically as soon as it can actually load.

## Implementation
1. Store the uploaded image as an immutable app asset so it is included in the installed Academia app and always available without data.
2. Update the shared Game background renderer used by normal play, offline Academia Play, and the completion screen:
   - render the castle image immediately underneath the authored background;
   - keep the castle visible while an original image or video is loading;
   - reveal the original only after an image finishes loading or a video can play;
   - return to the castle if the original media errors or becomes unavailable.
3. Preserve the existing Game background position, scale, opacity, animation, and creator settings. The fallback does not replace or rewrite saved Game backgrounds.
4. Ensure a cached original background can still appear offline; otherwise the castle remains visible until connectivity returns and the original successfully loads.
5. Add focused tests for image readiness, video readiness, failure fallback, and switching backgrounds. Verify both normal and offline Play visually at phone and desktop sizes.

## Offline update behavior
The castle image ships with the app shell, so the next published app update downloads it during the existing Academia Update/install process. It does not depend on the large-media download completing.
