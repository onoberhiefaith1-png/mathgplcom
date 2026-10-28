# Physics for Academia and Copilot

## Goal
Teach MathGPL to handle Physics the way it already handles Mathematics, using the three notes you uploaded:
1. a **Physics Symbol Library**, so symbols, units and their meaning in context are recognised and written correctly;
2. a **Physics lesson-note standard**, so Copilot writes complete 45-minute lessons (identification, objectives, introduction, content, worked examples, practical work, assessment);
3. **Smart picture choice**, so Copilot decides between a technical diagram, a real photo, an AI illustration and a graph.

The Mathematics engine, the Maths lesson rules, tables, Subcells, Floating Numbers and the Game stay exactly as they are. Physics is added on top of them and only switches on when the lesson is Physics.

## What you will see
- **Symbols menu (@ menu):** a new "Physics" group, sorted by topic (Mechanics, Energy, Fluids, Thermal, Waves, Optics, Electricity, Magnetism, Atomic). Each symbol shows its meaning and SI unit, for example "F · Force · N".
- **Units:** you can type m/s², N·m, J/(kg·K), Ω and µF directly, and they come out correctly on the Smartboard and the Game.
- **Copilot:** when a notebook or Academia Subject is Physics, Copilot follows the Physics standard. Every quantity gets its symbol, meaning and unit. Formulas are rearranged one step per line. Units are carried through every line of the working, and the final answer always has a unit.
- **Meaning from context:** Copilot reads the topic to decide what a symbol means, for example T as tension, period or temperature, and states it on first use.
- **Pictures:** for each visual, Copilot chooses the right kind:
  - forces and circuits get technical diagrams built by the existing diagram engine;
  - apparatus is shown as a real photo when one is available, otherwise an AI illustration;
  - motion and data get native graphs.
- **Ten training lessons:** the ten Physics topics you listed are saved as reference benchmarks. Copilot is checked against them, just as it is against the Maths benchmarks.
