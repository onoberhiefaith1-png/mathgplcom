# Make the first building's quality the standard for every cut-out

You are right that the first "morden building" is clean and the newer ones glitch.
I traced why, and the two cut-outs were not made the same way.

**The perfect one** was cut by the AI subject model. That model returns a soft,
graded edge — every edge pixel gets its own partial transparency — so the
building blends into the rotating scene with no white rim and no shimmer.

**The newer ones** are cut by the flat-colour region cutter added in the last two
sessions. It is good at one thing (it keeps white signage and glass inside the
building) but its edge is crude:

- every pixel is either fully kept or fully removed, with a single 1-pixel band
  fixed at one half-transparent value — no gradient at all;
- that hard edge is what you see as a jagged white rim, and as flicker/blur once
  the building rotates and is scaled on the homepage;
- any leftover backdrop just outside that one band stays fully opaque, which is
  the white square still visible behind some buildings.

## What this change does

1. **The AI model becomes the standard cut** for images again — the exact quality
   of the first building.
2. **Interior whites are still protected.** The flat-colour region map is kept,
   but demoted to a *guard*: it tells the cut which whites are inside the
   building so the model can never punch them out. Best of both, no trade-off.
3. **Real soft edges.** Where the region cutter is used (and for video, which
   cannot run the model per frame), the hard 1-pixel band is replaced by a true
   multi-pixel graded alpha with colour de-fringing, so the edge fades instead of
   stepping.
4. **Fix the buildings already saved.** A "Re-cut background" action on each
   existing building re-runs the new standard on the original upload, so the six
   glitching buildings can be brought to the same quality without re-uploading.
5. **One standard from now on.** "Remove background" everywhere — buildings,
   assets, homepage advertisements — goes through this same path, so the result
   is identical wherever it is used.
