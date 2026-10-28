// Six approved Chemistry reference lessons. Teaching references only — the
// Copilot learns their shape and quality, never copies their text. Replace or
// add lessons here without touching the standard or the validator.

export interface ChemistryBenchmark {
  id: string;
  title: string;
  level: string;
  approach: string;
  /** Every equation in the lesson; each must pass checkEquation. */
  equations: string[];
  /** Molar-mass facts the lesson relies on: [formula, g/mol]. */
  molarMasses?: Array<[string, number]>;
  note: string;
}

export const CHEMISTRY_BENCHMARKS: ChemistryBenchmark[] = [
  {
    id: "atomic-structure",
    title: "Atomic Structure — protons, neutrons, electrons and isotopes",
    level: "Secondary (SS1 / Year 10)",
    approach: "diagram-based concept teaching",
    equations: [],
    note: `Lesson information: Chemistry · Atomic Structure · Sub-atomic particles and isotopes · 45 minutes.
Learning objectives: name the three sub-atomic particles with relative mass and charge; use atomic number Z and mass number A to find protons, neutrons and electrons; define isotopes and give one example.
Prerequisite knowledge: elements are made of atoms.
Resources: periodic table, diagram of a carbon atom (nucleus with shells).
Introduction: "If everything is made of atoms, why is carbon different from oxygen?"
Explanation: the nucleus holds protons (mass 1, charge +1) and neutrons (mass 1, charge 0); electrons (mass 1/1840, charge −1) occupy shells. Z = number of protons; A = protons + neutrons; a neutral atom has as many electrons as protons. Notation ²³₁₁Na. Isotopes: same Z, different A, e.g. ¹²₆C and ¹⁴₆C. The Bohr shell model is a simplifying model.
Worked Example 1: Find the particles in ²³₁₁Na.
Solution 1: Protons = Z = 11 → Neutrons = A − Z → 23 − 11 → 12 → Electrons = 11 (neutral atom).
Worked Example 2: Electronic configuration of Na (Z = 11).
Solution 2: First shell holds 2 → second holds 8 → remaining 11 − 2 − 8 = 1 → configuration 2,8,1.
Classwork: particles in ³⁵₁₇Cl; configuration of Mg; explain why ¹²C and ¹⁴C are isotopes. Each followed by its Solution.
Conclusion: Z identifies the element; A − Z gives neutrons; isotopes differ only in neutrons.
Teacher guidance: misconception — "mass number counts electrons"; electrons are negligible in mass.`,
  },
  {
    id: "chemical-bonding",
    title: "Chemical Bonding — ionic and covalent bonds",
    level: "Secondary (SS1 / Year 10)",
    approach: "particle and electron diagrams, concept exploration",
    equations: ["2Na + Cl2 -> 2NaCl", "H2 + Cl2 -> 2HCl"],
    note: `Objectives: explain ionic bonding as electron transfer and covalent bonding as electron sharing; draw dot-and-cross descriptions for NaCl and H₂O.
Introduction: salt melts at 801 °C, water at 0 °C — why so different?
Explanation: Na (2,8,1) loses one electron → Na⁺ (2,8); Cl (2,8,7) gains one → Cl⁻ (2,8,8); opposite ions attract in a giant lattice → high melting point. Non-metals share pairs of electrons: in H₂O, O shares one pair with each H.
Equation: 2Na(s) + Cl₂(g) → 2NaCl(s).
Worked Example: describe bonding in MgO. Solution: Mg 2,8,2 loses 2e⁻ → Mg²⁺ → O 2,6 gains 2e⁻ → O²⁻ → ions attract → ionic lattice.
Classwork: predict bond type for KBr, CH₄, CO₂; explain why NaCl conducts when molten but not solid.
Teacher guidance: misconception — "ionic bonds are molecules"; NaCl is a lattice, the formula is a ratio.`,
  },
  {
    id: "balancing-equations",
    title: "Balancing Chemical Equations",
    level: "Secondary (SS1 / Year 10)",
    approach: "worked procedure with atom counting",
    equations: ["2H2 + O2 -> 2H2O", "CH4 + 2O2 -> CO2 + 2H2O", "2Al + 3CuO -> Al2O3 + 3Cu", "Ca(OH)2 + 2HCl -> CaCl2 + 2H2O"],
    note: `Objectives: state the law of conservation of mass; balance equations by changing coefficients only.
Explanation: atoms are rearranged, never created or destroyed, so each element has the same count on both sides. Never change a subscript — that changes the substance.
Worked Example 1: Balance H₂ + O₂ → H₂O.
Solution 1: Count O: 2 left, 1 right → put 2 before H₂O → H₂ + O₂ → 2H₂O → count H: 2 left, 4 right → put 2 before H₂ → 2H₂ + O₂ → 2H₂O → check H 4 = 4, O 2 = 2.
Worked Example 2: Balance CH₄ + O₂ → CO₂ + H₂O.
Solution 2: C balanced (1 = 1) → H: 4 left → 2H₂O → O right = 2 + 2 = 4 → 2O₂ → CH₄ + 2O₂ → CO₂ + 2H₂O.
Classwork: Al + CuO → Al₂O₃ + Cu; Ca(OH)₂ + HCl → CaCl₂ + H₂O.
Teacher guidance: treat a polyatomic ion that appears unchanged on both sides as one unit.`,
  },
  {
    id: "mole-concept",
    title: "Mole Concept and Stoichiometry",
    level: "Secondary (SS2 / Year 11)",
    approach: "numerical worked calculations with units",
    equations: ["CaCO3 -> CaO + CO2", "2Mg + O2 -> 2MgO", "N2 + 3H2 -> 2NH3"],
    molarMasses: [["CaCO3", 100], ["CaO", 56], ["MgO", 40], ["NH3", 17], ["H2O", 18]],
    note: `Objectives: calculate moles from mass (n = m ÷ M); use mole ratios to find product mass; identify a limiting reactant.
Explanation: 1 mol contains 6.02 × 10²³ particles; M is the relative formula mass in g/mol.
Worked Example 1: Mass of CaO from heating 50 g CaCO₃. CaCO₃(s) → CaO(s) + CO₂(g).
Solution 1: M(CaCO₃) = 40 + 12 + 3 × 16 → 100 g/mol → n = 50 ÷ 100 → 0.50 mol → ratio 1 : 1 → n(CaO) = 0.50 mol → M(CaO) = 56 g/mol → m = 0.50 × 56 → 28 g.
Worked Example 2 (limiting reactant): 2 mol N₂ with 3 mol H₂. N₂ + 3H₂ → 2NH₃.
Solution 2: 2 mol N₂ needs 2 × 3 → 6 mol H₂ → only 3 mol available → H₂ is limiting → n(NH₃) = 3 × 2 ÷ 3 → 2 mol → m = 2 × 17 → 34 g.
Classwork: mass of MgO from 12 g Mg; moles in 9 g of water.`,
  },
  {
    id: "acids-bases-neutralisation",
    title: "Acids, Bases and Neutralisation",
    level: "Secondary (SS1 / Year 10)",
    approach: "practical investigation (teacher-supervised)",
    equations: ["HCl + NaOH -> NaCl + H2O", "HCl + KOH -> KCl + H2O", "H2SO4 + 2NaOH -> Na2SO4 + 2H2O", "H^+ + OH^- -> H2O"],
    note: `Lesson information: 45 minutes. Objectives: define neutralisation; identify reactants and products; write balanced equations; explain one everyday application.
Introduction: antacid tablets relieve indigestion — what happens to the stomach acid?
Explanation: acid + base → salt + water. Ionic equation H⁺(aq) + OH⁻(aq) → H₂O(l). HCl(aq) + NaOH(aq) → NaCl(aq) + H₂O(l).
Worked Example: HCl reacting with KOH. Solution: acid HCl + base KOH → salt KCl + water → HCl(aq) + KOH(aq) → KCl(aq) + H₂O(l) → check K, Cl, H, O balanced.
Practical (teacher demonstration): dilute NaOH in a conical flask with phenolphthalein (pink); add dilute HCl from a burette until colourless. Precautions: goggles, dilute solutions only, wipe spills.
Classwork: define neutralisation; products of H₂SO₄ + NaOH; role of an indicator; one application (soil liming, antacids).
Teacher guidance: misconception — "neutral means no ions"; the salt solution still contains ions.`,
  },
  {
    id: "intro-organic",
    title: "Introduction to Organic Chemistry — alkanes and alkenes",
    level: "Secondary (SS2 / Year 11)",
    approach: "structural formulae and functional groups",
    equations: ["C2H4 + Br2 -> C2H4Br2", "C3H8 + 5O2 -> 3CO2 + 4H2O", "C2H4 + H2 -> C2H6"],
    note: `Objectives: define a homologous series; write molecular, structural and displayed formulae for the first four alkanes; identify the C=C functional group in alkenes; describe the bromine-water test.
Explanation: alkanes CₙH₂ₙ₊₂ are saturated (single C–C bonds); alkenes CₙH₂ₙ contain C=C. Ethene CH₂=CH₂.
Worked Example: complete combustion of propane. Solution: C₃H₈ + O₂ → CO₂ + H₂O → 3 C → 3CO₂ → 8 H → 4H₂O → O = 6 + 4 → 10 → 5O₂ → C₃H₈ + 5O₂ → 3CO₂ + 4H₂O.
Test for unsaturation: ethene decolourises orange bromine water: C₂H₄ + Br₂ → C₂H₄Br₂. Hydrogenation needs a nickel catalyst at about 150 °C.
Classwork: name C₄H₁₀; draw displayed formula of propene; explain why ethane does not decolourise bromine water.`,
  },
];

/** Compact block for the Copilot prompt: shape and quality, not text to copy. */
export const CHEMISTRY_BENCHMARK_SUMMARY = [
  "CHEMISTRY REFERENCE LESSONS (learn their shape and quality; never copy their text into other lessons):",
  ...CHEMISTRY_BENCHMARKS.map((b) => `\n— ${b.title} [${b.level}; ${b.approach}]\n${b.note}`),
].join("\n");
