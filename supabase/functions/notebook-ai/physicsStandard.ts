// PHYSICS SUBJECT STANDARD — a subject-gated add-on. It is appended to the
// Maths standards only when the lesson's Subject is Physics, and never edits
// any Maths standard.

/** Is this Subject (notebook or Academia Subject name) Physics? */
export function isPhysicsSubject(subject?: string | null): boolean {
  const s = String(subject ?? "").toLowerCase();
  return /\bphysics\b|\bphysical science\b/.test(s);
}

/** Symbols whose meaning depends on topic; resolved by the topic words. */
export const CONTEXT_SYMBOLS: Record<string, Array<{ meaning: string; unit: string; topics: RegExp }>> = {
  T: [
    { meaning: "tension", unit: "N", topics: /force|newton|string|cable|pulley|equilibrium|tension/ },
    { meaning: "period", unit: "s", topics: /wave|oscillat|pendulum|circular|orbit|period|sound|frequency/ },
    { meaning: "absolute temperature", unit: "K", topics: /heat|thermal|gas|temperature|thermo/ },
  ],
  V: [
    { meaning: "potential difference", unit: "V", topics: /circuit|electric|voltage|current|resist|capacit/ },
    { meaning: "volume", unit: "m³", topics: /gas|density|fluid|pressure|volume|upthrust/ },
  ],
  Q: [
    { meaning: "electric charge", unit: "C", topics: /charge|circuit|electric|capacit|current/ },
    { meaning: "heat transferred", unit: "J", topics: /heat|thermal|temperature|latent|specific heat/ },
  ],
  C: [
    { meaning: "capacitance", unit: "F", topics: /capacit|circuit|electric/ },
    { meaning: "heat capacity", unit: "J/K", topics: /heat|thermal/ },
  ],
  P: [
    { meaning: "power", unit: "W", topics: /power|energy|work|electric/ },
    { meaning: "pressure", unit: "Pa", topics: /pressure|fluid|gas/ },
  ],
};

/** Meaning of a context-dependent symbol for a topic, or null if unknown. */
export function resolveSymbolMeaning(symbol: string, topic: string): { meaning: string; unit: string } | null {
  const opts = CONTEXT_SYMBOLS[symbol];
  if (!opts) return null;
  const t = topic.toLowerCase();
  const hit = opts.find((o) => o.topics.test(t));
  return hit ? { meaning: hit.meaning, unit: hit.unit } : null;
}

export const PHYSICS_STANDARD = `
PHYSICS LESSON-NOTE STANDARD (applies because the Subject is Physics; all
Mathematics standards above still apply unchanged)

LEVEL AND SHAPE
- Secondary-school Physics (Nigerian senior secondary and GCSE-style), standard
  45-minute lesson. If the topic is too broad, teach a coherent subset and state
  the scope.
- Structure: Lesson identification (Subject, Class, Topic, Subtopic, Duration,
  Previous knowledge, Instructional materials/apparatus) → Measurable objectives
  (define, identify, label, draw, measure, calculate, interpret, explain) →
  Introduction linked to a familiar observation, with diagnostic questions →
  Content → Worked examples → Practical activity → Evaluation/Assessment →
  Summary → Assignment. Objectives must match what is taught and assessed.

CONCEPTS
For each concept: correct definition → plain explanation → symbol → meaning of
each symbol → SI unit → governing principle or equation → why it applies →
worked example → common misconception.

SYMBOLS AND UNITS
- On first use, state every quantity as: symbol = meaning (unit), e.g.
  "F = force (N)". Use standard symbols (u, v, a, s, t, F, m, p, E, W, P, ρ, λ,
  f, I, V, R, Q, C, B, Φ, ε).
- A symbol's meaning comes from the topic: T is tension in forces, period in
  waves/oscillation, temperature in heat; V is voltage in circuits, volume in
  gases/fluids; Q is charge in electricity, heat in thermal physics; C is
  capacitance or heat capacity. State which meaning applies.
- Write units with proper symbols: m/s², N·m, J/(kg·K), kg/m³, Ω, µF, K⁻¹. Never
  "m/s^2", "ohm" or "uF". Use SI prefixes correctly and convert to base SI units
  BEFORE substituting.

WORKED CALCULATIONS (classroom whiteboard style, one micro-step per line)
1. List the given data, each with symbol, value and unit.
2. State what is required.
3. Write the formula.
4. Rearrange it one step per line if needed.
5. Substitute values WITH units.
6. Evaluate one step per line, carrying units on every line.
7. Final answer with correct unit and sensible significant figures.
A final answer without a unit is wrong.

PRACTICALS
Name the apparatus, procedure, variables (independent, dependent, controlled),
precautions, sources of error, a results table with units in the headings, and
the conclusion.
`.trim();
