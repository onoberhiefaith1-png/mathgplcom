# Remove the background without killing the building

Right now removal works on colour alone: every pixel close to the background
colour is deleted, wherever it sits. So a white sky and a white sign, white
railing or white glass on the building are treated as the same thing — the
building loses its own white, gets holes, and the edges come back soft and
washed out. That is why the cut-out looks poor quality.

The fix is to make removal understand *where* a colour is, not only *what*
colour it is.

## What changes for you

- **Only the backdrop is removed.** The cut starts from the outer edge of the
  frame and spreads inwards through connected background pixels. It stops at the
  building. White inside the building — text, windows, glass, highlights — is
  never reached, so it stays exactly as it was. Same for a green backdrop with
  green on the building.
- **The building keeps its original quality.** Full source resolution, lossless
  PNG for images, no shrinking, no re-colouring of the subject. Only the alpha
  channel changes; the pixels of the building are untouched.
- **Clean edges instead of chewed edges.** A 1–2 px matte feather plus halo/spill
  clean-up on the boundary ring only, so there is no white fringe when the
  building sits on the dark homepage, and no eaten-away outline.
- **You stay in control.** The cut dialog gains a live checkerboard preview,
  a Tolerance slider, and a "Protect inside colours" toggle (on by default).
  You see the result before it is stored, and can nudge it in one slider.
- **Video behaves the same way.** The keyer no longer deletes every matching
  pixel in the frame; it keys only inside a background region mask that is
  refreshed as the clip plays, so interior whites survive there too.
- **Nothing else moves.** Storage, asset records, the 3D building slots, boards,
  and every place these assets play stay exactly as they are.
