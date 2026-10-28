# Liquid Fill: full parity with the Segmented progress bar

## What is already shared (verified in the code)

Both types already read from one `ProgressConfig` on the canvas element, and the editor already shows the same common sections for either type: Transform (X, Y, width, scale, rotation, opacity), Layer & Blend, Motion, Slant, Name, Questions, Progress Bar Type, Style, and Scoring (marks to pass, live marks, glow, class goal). The canvas already renders whichever type is selected inside the same wrapper, so move/scale/rotate/opacity/slant/animation apply to the liquid vessel exactly as to the tower.

So this is not a rebuild. Four things are genuinely missing or wrong for Liquid Fill:

1. **Fill colour is not configurable.** The vessel paints from a fixed theme palette (blue/green/purple/orange/gold). `Fill style` and `Fill color` are currently hidden whenever the type is Liquid.
2. **No Energy mode.** Energy is a segmented-only section, so a liquid bar cannot use an uploaded energy effect at all.
3. **Score display is tied to the design, not to scoring.** The bottom plate prints `current/max`, which is right, but nothing guarantees it reflects the same source as the tower and the denominator wording ("Marks to pass") is not surfaced next to it.
4. **No "use my uploaded frame"** option in the Liquid style list.

## The change

- Show **Fill style** for Liquid Fill too, with the same two choices: **Plain colour** and **Energy**.
- Plain colour: the teacher's chosen colour drives the liquid gradient (a lighter tint on top, a deeper shade at the base derived from the one colour), so the vessel keeps its glassy look with any colour. Falls back to the style's palette when no colour is set.
- Energy: the filled region becomes a **continuous particle field** clipped to the chamber — many small copies of the chosen energy effect, scattered across the filled area only, drifting and shimmering, denser as the level rises. Particle count comes from area and density, never from question count.
- The liquid level and the particle field both use the one existing calculation, `currentMarks / totalMarks`, clamped 0–100%.
- The score plate keeps reading `current / total` from that same config, so `0/400 → 25/400 → 400/400` follows scoring automatically.
- Add **Use my uploaded frame** to the Liquid style list, matching the Segmented list.
- Segmented behaviour, presets, per-slot energy and slot count stay exactly as they are.
