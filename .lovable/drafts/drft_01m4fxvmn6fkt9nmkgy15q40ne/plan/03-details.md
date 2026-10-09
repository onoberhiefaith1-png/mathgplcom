## Technical details

1. Replace the presentation-only `1.35× / 420–860 px` geometry width with the lesson-note natural-width rule, capped at `520 px`.
2. Change the Smartboard geometry style from a forced `54rem` width and `26rem` minimum to intrinsic width with a `100%` safety cap.
3. Add a focused sizing test confirming that presentation mode no longer enlarges a lesson-note-sized diagram.
4. Run the geometry tests and inspect the affected Smartboard at **949 × 447** with the Properties panel open, confirming the diagram, writing, and panel fit without overlap.