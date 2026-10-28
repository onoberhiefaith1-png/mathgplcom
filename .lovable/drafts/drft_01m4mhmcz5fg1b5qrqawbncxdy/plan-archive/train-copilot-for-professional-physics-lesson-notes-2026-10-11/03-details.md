## 1. Symbols through Floating Numbers
- Each Physics quantity becomes one chip, so it is never split into separate letters. This covers quantities like Eₖ, Fₙₑₜ, ε₀, μ₀ and t½, and symbols like λ, ρ, Φ and Ω.
- Units stay together as one chip: m/s², kg/m³, J/(kg·K), N·m, K⁻¹, µF.
- A number and its unit, such as 15 m/s, can be one chip or two. You decide this per question; the default is two.
- Scientific notation is kept as written, for example 3 × 10⁸.
- The equation-of-motion step lines are marked correctly by the existing instant marking. Any spaces, units or Greek letters a student adds in a slightly different way still count as the same answer.

## 2. Diagrams that behave like Geometry
Copilot describes the diagram, and the existing diagram engine draws it. It is built from the solution, just like the Geometry Map, so it is never pasted in as a picture. Five Physics diagram types are added:
- **Free-body:** a body, plus force arrows with their direction, label and size.
- **Circuit:** cell, resistor, lamp, switch, ammeter and voltmeter on closed loops. The system checks that every component is connected, the ammeter is in series and the voltmeter is in parallel.
- **Ray:** glass block, mirror or lens, with the normal and the angles i and r.
- **Wave:** transverse or longitudinal, with wavelength and amplitude marked.
- **Field lines:** bar magnet or wire.

Each type is editable in the right-hand Properties Panel, like every other asset.

## 3. Tables
- Results and data tables come through as one SmartTable, with units in the headings, for example "t (s)", "v (m/s)".
- Calculated columns use Subcells: the working above the blue line and the answer below, exactly as in Maths.
- A table that would only repeat a calculation already shown in the working is not created.

## 4. Copilot training
- The Physics standard is extended with these three rules: how to write symbols, when to draw each diagram type, and when to make a table.
- Worked examples from the five lessons already loaded become benchmarks for Copilot to match.
- Everything only applies when the Subject is Physics; Maths stays exactly as it is.

## 5. Proof it works
- **Automatic tests:**
  - every symbol and unit stays one chip;
  - the lines are marked correctly;
  - each diagram type is built, and a wrongly wired circuit is rejected;
  - a results table becomes a SmartTable with unit headings.
- **One real Copilot lesson:** Copilot writes a real Physics lesson on Ohm's law, with a circuit diagram and a table. I check it on the Smartboard, in Floating Numbers and in the Game.
  - Cost: about 0.2 credits.
  - When: only after you approve.

## Technical details
- The Floating Numbers tokenizer (`src/lib/floating/atoms.ts`) gets a Physics token table, taken from `assets/physics.ts`, for subscripted symbols and compound units. A grapheme-safe longest match is applied before the existing operator split.
- `diagramSpec.ts` gets these kinds: `freeBody`, `circuit`, `ray`, `wave`, `fieldLines`. Renderers are added next to `geometryFromSpec.ts`, and a pure `validateCircuit()` checks the wiring.
- `deriveSubcells.ts` already handles tables; `physicsStandard.ts` gets a table directive with unit headings.
- The training is added to `physicsStandard.ts` and `visualSelectionStandard.ts` (subject-gated). Notebook-ai only goes live once you accept this draft.
- The background loader is stopped, and the orphaned partial Heat lesson is deleted.
