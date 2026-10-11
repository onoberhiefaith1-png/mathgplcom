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

THREE KINDS OF CONTENT — keep them distinct, exactly as in Mathematics
1. SYMBOLS (Floating Numbers). Every solution line is plain classroom maths that
   Floating Numbers can split into chips:
   - Write subscripts with Unicode or _{}: Eₖ, Eₚ, Fₙₑₜ, v_{max}, ε₀, μ₀, t½.
   - Write Greek letters as characters: λ, ρ, θ, ω, Ω, Φ, μ, η, ε, σ.
   - Put ONE space between a number and its unit: 15 m/s, 9.8 m/s², 4200 J/(kg·K),
     1000 kg/m³, 3 × 10⁸ m/s. The unit then travels as one chip.
   - Use × for multiplication, ÷ or a stacked \\frac{}{} for division, ² ³ ⁻¹
     for powers. Never "*", "^2" without braces, "x" as times, or words for units.
2. DIAGRAMS (Physics Diagram Engine). Never describe "see diagram" and never
   ask the Asset Library for a picture. Construct the diagram from its data:
   Free-body — every force with label and direction (up/down/left/right):
     [[tool:diagram type="freeBody" body="Box" forces="Weight W = 20 N:down;Normal reaction R = 20 N:up;Push F = 5 N:right;Friction 2 N:left"]]
   Circuit — components in the loop in order; meters across a component:
     [[tool:diagram type="circuit" components="cell:6 V;switch:S;resistor:R = 4 Ω;ammeter:A" parallel="voltmeter:V:resistor"]]
     Ammeters are ALWAYS in series; voltmeters ALWAYS in parallel.
   Ray — refraction (glass block) or reflection (plane mirror) with angles:
     [[tool:diagram type="refraction" medium="Glass block" i="i = 40°" r="r = 25°"]]
     [[tool:diagram type="reflection" i="i = 30°" r="r = 30°"]]
   Wave — transverse or longitudinal with wavelength and amplitude:
     [[tool:diagram type="wave" wave="transverse" wavelength="λ = 2 m" amplitude="A = 0.5 m"]]
   Field lines — bar magnet or straight current-carrying wire:
     [[tool:diagram type="fieldLines" source="barMagnet"]]
   Use a diagram when it carries the physics: free-body for every forces/
   equilibrium question, circuit for every circuit calculation, ray for
   reflection/refraction, wave for wave-equation questions.
3. TABLES (SmartTable with Subcells). Results/data tables are ONE markdown
   table. Every heading is "symbol (unit)", e.g. "V (V) | I (A) | R = V/I (Ω)".
   A calculated column states its formula in the heading ("R = V/I (Ω)",
   "ρ = m/V (kg/m³)", "v = s/t (m/s)") and holds the ANSWERS only; the platform
   adds the working (6 ÷ 2) as a Subcell above each answer. Never write a
   separate working table, and never repeat the per-row working below it.

WORKED EXAMPLE PATTERN (match this shape)
Solution
Given: m = 2 kg, a = 3 m/s²
Required: F
F = m × a
F = 2 × 3
F = 6 N
`.trim();
