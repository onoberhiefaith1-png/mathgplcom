# Train the Engine to draw geometry properly

This is a drawing-only training pass. No lesson-note work, no 3D. The goal is that when the
Engine is asked for a figure, the figure comes out looking like a textbook diagram: exact
angles, points really on the circle, produced lines really collinear, every letter the
question names present, nothing overlapping, nothing outside the frame.

The machinery for this already exists and is good: the Engine returns a **construction
program** (a list of geometric instructions), the app solves it exactly, then verifies the
finished figure and refuses anything that fails. What is missing is **training pressure** —
nobody has run hundreds of real geometry questions through it, looked at every drawing, and
fixed what came out wrong.

So this pass builds a drawing range: a bank of real WAEC/IGCSE/JAMB-style geometry questions,
a harness that asks the Engine to draw each one for real, and a contact sheet of every
resulting diagram rendered as a picture, so failures are visible rather than theoretical.
Then rounds: run, look, fix, run again — until the pass rate stops improving.

One gap gets closed as part of this. There are currently two drawing paths: the construction
path (exact, verified) and an older path where the model invents raw x/y coordinates for a
scene. The second is where crooked, unlabelled, off-circle figures come from. It gets moved
onto the construction path so there is only one way to draw.
