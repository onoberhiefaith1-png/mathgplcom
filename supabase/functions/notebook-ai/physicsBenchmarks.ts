// The ten Physics training lessons. Each one tests a different presentation
// demand; Copilot output on these topics is checked against what they require.

export const PHYSICS_BENCHMARK_TOPICS = [
  { topic: "Physical Quantities, SI Units, Measurement and Errors", tests: "tables, units, prefixes, significant figures, conversions, precision vs accuracy, measuring instruments" },
  { topic: "Motion: Speed, Velocity, Acceleration and Motion Graphs", tests: "formulas, rearrangement, multi-step calculations, distance-time and velocity-time graphs" },
  { topic: "Forces, Newton's Laws and Equilibrium", tests: "free-body diagrams, vector arrows, resolution, friction, resultant force" },
  { topic: "Work, Energy, Power, Momentum and Simple Machines", tests: "related formulas, conservation laws, efficiency, applied problems" },
  { topic: "Density, Pressure, Upthrust and Fluid Mechanics", tests: "labelled apparatus, fluid diagrams, derivations, density calculations" },
  { topic: "Heat, Temperature, Thermal Expansion and Gas Laws", tests: "concept distinctions, experimental setups, tables, graphs, assumptions" },
  { topic: "Waves, Sound and Wave Properties", tests: "wave diagrams, wavelength, amplitude, frequency, period, v = fλ" },
  { topic: "Reflection, Refraction, Lenses and Optical Instruments", tests: "accurate ray diagrams, angles, image formation, magnification, sign conventions" },
  { topic: "Electricity, Circuit Analysis, Resistance and Capacitors", tests: "circuit symbols, correctly connected circuits, series/parallel, Ohm's law, power, capacitors" },
  { topic: "Magnetism, Electromagnetic Induction, Atomic and Nuclear Physics", tests: "field-line diagrams, induction, nuclear notation, decay equations" },
] as const;

export const PHYSICS_BENCHMARK_SUMMARY = `
PHYSICS BENCHMARK EXPECTATIONS — when the lesson matches one of these topics,
it must demonstrate what that benchmark tests:
${PHYSICS_BENCHMARK_TOPICS.map((b, i) => `${i + 1}. ${b.topic} — ${b.tests}.`).join("\n")}
`.trim();
