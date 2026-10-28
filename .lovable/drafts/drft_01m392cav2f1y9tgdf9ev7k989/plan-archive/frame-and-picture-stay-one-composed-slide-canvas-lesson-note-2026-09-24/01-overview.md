# Frame and picture stay one composed slide: Canvas, Lesson Note, Smartboard

Your photos show the problem clearly. In Canvas/Edit the Assignment picture fills the slide edge to edge. On the Smartboard the same slide shows the picture smaller, with white strips around it.

**Why it happens (confirmed earlier):** Canvas stretches the picture past its box with a zoom value, but that zoom is not saved yet. The saving slot only gets added when this draft is accepted. Until then every other screen redraws the picture at 100%, which brings back the white gaps. The viewer also adds its own side padding around the slide, which shrinks the frame a little more.

**What changes**
1. **One composition.** The slide's frame (16:9) plus each picture's position, size, zoom and edge coverage get saved together, and this saved state is the only thing the Lesson Note and Smartboard draw from. If the picture fills the frame in Canvas, it fills it everywhere. If you left a gap on purpose, the gap stays.
2. **Save button** on the Canvas editor bar. It forces an immediate save of every picture's position, size, zoom and edge coverage, then shows "Saved". Autosave still runs, and Save is the guaranteed save.
3. **"Fills the frame" is remembered.** When a picture is dragged or zoomed to reach all four edges, it is marked as covering the frame and snapped exactly to the edges. Lesson Note and Smartboard then draw it with zero gap on any screen size, with no rounding slivers.
4. **No extra margins while drawing.** The side padding around the slide is removed. The arrows sit on top of the slide's edges, so the frame keeps its exact shape and no white strips appear.
5. **Enlarging stays as it is now.** Lesson Note and Smartboard zoom (50–500%) grow the whole composed slide in proportion and push the text below downward. Smartboard zoom only changes the teaching size and never rewrites the Canvas design.
6. **Canvas/Edit behaviour is not changed**, apart from the new Save button and the "fills frame" flag it records.

**Important:** the saved zoom only works once you **accept this draft**, because that is when the saving slot is added. Right now the preview can't prove the full fix. Straight after accepting, I will run your three acceptance tests.
