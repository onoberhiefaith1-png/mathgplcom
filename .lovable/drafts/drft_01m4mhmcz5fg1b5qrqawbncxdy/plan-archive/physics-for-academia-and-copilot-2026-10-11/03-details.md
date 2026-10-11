## Out of scope for now
- **Drawn circuit symbols:** a full schematic library (resistors, diodes, transistors) with correct terminals and connection checks is its own project. In this stage, circuits use the existing diagram engine, plus a check that every component sits on a closed loop.
- **Physics in the Game:** no Game changes. Physics questions play the same way Maths questions do.

## Order of work
1. Symbol library and units, with tests.
2. Physics lesson-note standard and Subject detection in Copilot.
3. Visual chooser.
4. The ten benchmark lessons. Copilot is checked against them using a few credits, and you approve before this step runs.

## Technical details
- New `src/lib/lessonnotes/assets/physics.ts`: entries with symbol, meaning, SI unit, topic and other meanings. It is registered in `registry.ts` as the "Physics" category, and `types.ts` gains that category.
- Unit tokens (`·`, `²`, `⁻¹`, `Ω`, `µ`) pass through the existing symbol pass-through without change.
- New `supabase/functions/notebook-ai/physicsStandard.ts` and `visualSelectionStandard.ts`. They are added in `sharedKnowledge.ts` only when the subject is Physics, so Maths prompts stay byte-identical.
- Subject comes from the notebook or the Academia Subject name, using a pure `isPhysicsSubject()` helper.
- The ten benchmarks go into `docs/MathGPL Knowledge Base/Benchmark Library/Physics/`, with a summary in `benchmarkStandard`.
- Tests cover: symbol lookup and units; T resolving to tension, period or temperature by topic; Maths prompt unchanged; the Physics prompt including units-on-every-line.
- `AGENTS.md` gets a rule: Physics standards are subject-gated add-ons and never edit the Maths standards.
