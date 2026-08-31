# Final Touch — one-revolution glitch clean-up

The building settings already carry Opacity, Blend mode and background removal, but each
value is guessed from a single frame. As the building turns, later frames disagree with that
guess, so you see halos, flicker, leftover backdrop patches and a flash when the loop restarts.

Final Touch adds one button to Building settings that watches the building through a whole
revolution, measures every problem it finds, and then sets the existing controls to values
that hold for the entire loop. Nothing is re-uploaded and nothing is destroyed — it only
tunes the settings you can already see and change by hand afterwards.

## What the button does

1. Plays the building silently, off-screen, from start to end of one full revolution
   (for a video: its whole duration; for the MathGPL/rotating image building: a full turn).
2. Samples frames across the loop and measures, per frame:
   - the backdrop colour actually present at the frame border,
   - how much of that backdrop survives the current cut (leftover patches),
   - the brightness/colour of the ring of pixels just inside the subject edge (halo),
   - how much the cut area changes between neighbouring frames (flicker),
   - how far the first frame differs from the last (loop seam).
3. Picks one settings set that is good for every sampled frame, not just the best frame:
   - key colour = the colour agreed by the whole loop, not one frame,
   - tolerance = the smallest value that clears the backdrop in the *worst* frame,
   - edge softness = enough feather to hide the measured halo, capped so detail survives,
   - blend mode = kept at Normal unless the loop shows a genuinely black backdrop, where
     Screen removes it cleanly,
   - opacity = untouched unless it was already reducing visibility of a clean cut.
4. Shows a short report: "Scanned 1 revolution · halo removed · flicker reduced ·
   backdrop cleared · loop seam smoothed", plus a per-issue tick or warning so an
   unfixable clip is stated honestly rather than silently accepted.
5. Leaves everything staged — the homepage only changes when Save Building is pressed.

## Loop seam

The seam flash is handled in playback, not in the file: when the measured first/last frame
difference is above the noise floor, the building crossfades over the last fraction of a
second into the restart, so one revolution runs into the next without a pop.
