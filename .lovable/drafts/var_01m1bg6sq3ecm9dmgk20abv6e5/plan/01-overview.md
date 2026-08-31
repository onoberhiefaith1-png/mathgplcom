# Reliable background detection for uploads

Today, when you tick "Remove background before storing", the dialog samples only
8 single pixels around the edge of the very first frame and averages them. If the
subject touches an edge, the white has a soft gradient or vignette, or the first
frame is still fading in, the check fails — and the dialog then shows
"checking…" forever, so it looks like the system is thinking when it has in fact
already given up.

This upgrade replaces that guesswork with a proper detection pass and makes the
result visible and correctable.

## What changes for you

- **White (and any flat) backgrounds are detected reliably.** Detection looks at
  a wide border ring of the frame, across several frames of a video, and finds
  the dominant colour by how much of that ring it covers — instead of trusting
  eight lone pixels.
- **Soft, shaded and slightly-gradient white backgrounds still count as flat.**
  Detection tolerates lighting falloff, JPEG noise and compression blocking.
- **The dialog tells you the truth.** Three honest states: *Checking…*,
  *Background detected* with the colour swatch and a confidence note, or
  *Background isn't a flat colour* with an explanation.
- **You can override it.** If detection is unsure, pick the background colour
  yourself by clicking on a preview frame of your own clip, and the cut uses
  exactly that colour.
- **Nothing else moves.** The chroma cut, edge softness, transparent WebM output,
  images path, storage and every board that plays these assets stay as they are.
