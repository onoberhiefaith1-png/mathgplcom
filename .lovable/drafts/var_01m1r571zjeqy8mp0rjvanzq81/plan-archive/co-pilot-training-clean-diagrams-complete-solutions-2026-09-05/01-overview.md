# Co-Pilot training: clean diagrams, complete solutions

Two problems, both fixed inside the maths generation and note layout — no visual redesign.

## 1. The diagram sits on top of the equations

Today a diagram is treated as a free-floating picture: the note layout deliberately
skips it when working out how much room a section needs, so equation lines end up
underneath it. Nothing tells the system which part of the note the diagram belongs to.

The fix is to make the note read **section by section**:

- A diagram is owned by the question section it illustrates, and it gets its own
  reserved band inside that section.
- The band takes real space, so the working, the solution steps and any equation
  always start **below** the diagram, never across it.
- While the system is writing or checking equations, the figure is behind the
  writing layer, never in front of it.
- One question owns one diagram (already the rule) — a Solution section never draws
  its own second figure; it points back to the question's figure.

## 2. Solutions stop half way

Right now the main solution request is sent with no length safeguard and no check
that the answer actually finished. When the model runs out of room the text simply
stops mid-step. Because the solution never reaches its final answer, the parts that
read the finished solution — floating numbers and the assignment/practice follow-up —
find nothing to work with and quietly disappear.
