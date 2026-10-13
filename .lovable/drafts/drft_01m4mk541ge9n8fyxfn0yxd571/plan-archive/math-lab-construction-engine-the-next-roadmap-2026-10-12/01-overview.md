# Math Lab Construction Engine — the next roadmap

Your four documents ask for one change of direction: Math Lab must stop being a set of tools you pick from and become **one engine that understands whatever the student types**, builds the picture from first principles, checks it, and teaches it. No AI, no internet after first load. The library examples stay, but only as examples.

Everything built in Stages 1–12 is kept. Smartboard, Lesson Notes and the Lesson Note graph are not touched.

## How every input is handled (the same six steps for all maths)

Recognise → Decompose → Calculate → Construct → Verify → Explore.

The student types into **one box**. Math Lab decides itself whether it is a curve, an implicit shape, a system of equations, a 3D solid, a matrix, a distribution, an ODE or a complex map, and opens the right view. If something cannot be drawn honestly, it says why instead of inventing a picture.

## Three learning modes on every result

- **Explore** — a guiding question first ("What does it mean when two lines meet?"), the student drags and inspects before the answer appears.
- **Step-by-Step** — one justified step at a time, in the classroom style (one micro-step per line).
- **Show Solution** — full answer plus the matching picture.

All three are produced by the engine's own calculations.

## Stages (built one at a time; say "next stage" to move on)

**Stage 13 — The single input box and interpreter.** One box replaces choosing a panel. It recognises the kind of maths and routes it to the existing engines. Adds a coordinate table under every curve (x, y, point), and key features computed, not looked up: roots, turning point, axis of symmetry, intercepts. *Significance: the student never needs to know which tool to choose — they type the maths they meet in class.*

**Stage 14 — Explore / Step-by-Step / Show Solution.** The three modes and a step writer, starting with simultaneous equations (2x = y + 3, x + y = 6 → (3, 3), with parallel/coincident detection when coefficients change) and quadratics with transformations (vertex form, sliders for a, h, k). *Significance: Math Lab teaches the why, not just the answer.*

**Stage 15 — Concept entry ("Explore Concept").** Typing a concept such as "eigenvalues", "binomial distribution", "Riemann sums", "Fourier series" or "4D geometry" asks for the needed values, then builds the demonstration. Uses an on-device list of concepts, no AI guessing.

**Stage 16 — Solids and word-style geometry.** "Cube with side 5 cm" → rotatable cube, Unfold to a net, volume 125 cm³, surface area 150 cm², space diagonal 5√3 cm; then cuboid, prism, cylinder, cone, sphere by the same builder. Plus the unit circle with live sin/cos/tan.

**Stage 17 — The remaining reference journeys** from your document: binomial distribution, Riemann sums to the definite integral, eigenvectors shown as unchanged directions, exponential decay, complex mappings (grid in z-plane → w-plane), and boundaries/tangent planes on surfaces — each rebuilt as a guided journey using the engines already made in Stages 6–11.

**Stage 18 — Verification and honesty layer.** Every drawing is checked against its own numbers (plotted roots really are roots; sampled implicit points really satisfy the equation). Clear messages for unsupported or undefined input. A test for each of the ten reference journeys with the expected answers from your document, plus unseen variations of each.
