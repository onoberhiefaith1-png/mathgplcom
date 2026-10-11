// Chemistry library from the supplied Chemistry Symbol Library document.
// Entries marked `review` were blank in the source and filled with the
// standard symbol for that meaning.
import type { SubjectEntry, SubjectLibrary, SubjectSection } from "./types";

const e = (id: string, symbol: string, meaning: string, unit?: string, extra: Partial<SubjectEntry> = {}): SubjectEntry =>
  ({ id, symbol, meaning, unit, ...extra });
const r = (id: string, symbol: string, meaning: string, unit?: string, alsoMeans?: string[]) =>
  e(id, symbol, meaning, unit, { review: true, alsoMeans });
const sec = (id: string, name: string, entries: SubjectEntry[], desc?: string): SubjectSection => ({ id, name, entries, desc });

const ELEMENTS_RAW =
  "H Hydrogen|He Helium|Li Lithium|Be Beryllium|B Boron|C Carbon|N Nitrogen|O Oxygen|F Fluorine|Ne Neon|" +
  "Na Sodium|Mg Magnesium|Al Aluminium|Si Silicon|P Phosphorus|S Sulfur|Cl Chlorine|Ar Argon|K Potassium|Ca Calcium|" +
  "Sc Scandium|Ti Titanium|V Vanadium|Cr Chromium|Mn Manganese|Fe Iron|Co Cobalt|Ni Nickel|Cu Copper|Zn Zinc|" +
  "Ga Gallium|Ge Germanium|As Arsenic|Se Selenium|Br Bromine|Kr Krypton|Rb Rubidium|Sr Strontium|Y Yttrium|Zr Zirconium|" +
  "Nb Niobium|Mo Molybdenum|Tc Technetium|Ru Ruthenium|Rh Rhodium|Pd Palladium|Ag Silver|Cd Cadmium|In Indium|Sn Tin|" +
  "Sb Antimony|Te Tellurium|I Iodine|Xe Xenon|Cs Caesium|Ba Barium|La Lanthanum|Ce Cerium|Pr Praseodymium|Nd Neodymium|" +
  "Pm Promethium|Sm Samarium|Eu Europium|Gd Gadolinium|Tb Terbium|Dy Dysprosium|Ho Holmium|Er Erbium|Tm Thulium|Yb Ytterbium|" +
  "Lu Lutetium|Hf Hafnium|Ta Tantalum|W Tungsten|Re Rhenium|Os Osmium|Ir Iridium|Pt Platinum|Au Gold|Hg Mercury|" +
  "Tl Thallium|Pb Lead|Bi Bismuth|Po Polonium|At Astatine|Rn Radon|Fr Francium|Ra Radium|Ac Actinium|Th Thorium|" +
  "Pa Protactinium|U Uranium|Np Neptunium|Pu Plutonium|Am Americium|Cm Curium|Bk Berkelium|Cf Californium|Es Einsteinium|Fm Fermium|" +
  "Md Mendelevium|No Nobelium|Lr Lawrencium|Rf Rutherfordium|Db Dubnium|Sg Seaborgium|Bh Bohrium|Hs Hassium|Mt Meitnerium|Ds Darmstadtium|" +
  "Rg Roentgenium|Cn Copernicium|Nh Nihonium|Fl Flerovium|Mc Moscovium|Lv Livermorium|Ts Tennessine|Og Oganesson";

export const CHEMISTRY_ELEMENTS: SubjectEntry[] = ELEMENTS_RAW.split("|").map((pair, i) => {
  const [sym, name] = pair.split(" ");
  return e(`el_${sym}`, sym, name, undefined, { example: `Atomic number ${i + 1}` });
});

const list = (prefix: string, rows: [string, string, string?][]) =>
  rows.map(([s, m, u], i) => e(`${prefix}_${i}`, s, m, u));

const APPARATUS = ["Beaker", "Conical flask", "Volumetric flask", "Measuring cylinder", "Burette", "Pipette", "Test tube",
  "Funnel", "Filter paper", "Evaporating basin", "Crucible", "Thermometer", "Balance", "Bunsen burner", "Tripod and gauze",
  "Retort stand and clamp", "Condenser", "Gas syringe", "Delivery tube", "Separating funnel", "pH meter", "Electrodes", "Fume cupboard"];
const HAZARDS = ["Explosive", "Flammable", "Oxidising", "Gas under pressure", "Corrosive", "Acute toxicity",
  "Irritant / harmful", "Serious health hazard", "Environmental hazard"];

export const CHEMISTRY_LIBRARY: SubjectLibrary = {
  id: "chemistry",
  name: "Chemistry",
  status: "ready",
  sections: [
    sec("elements", "1. Chemical elements (118)", CHEMISTRY_ELEMENTS, "First letter capital, second lowercase."),
    sec("formula", "2. Formula notation", [
      ...list("cf", [["H₂O", "Subscript: number of atoms — water"], ["2H₂O", "Coefficient: number of molecules"],
        ["Ca(OH)₂", "Brackets: repeated group"], ["[H⁺]", "Square brackets: concentration"], ["CuSO₄·5H₂O", "Dot: hydrate"],
        ["Na⁺", "Superscript charge"], ["O²⁻", "Superscript charge (2−)"], ["¹⁴C", "Mass number (isotope)"], ["₆¹⁴C", "Nuclide: atomic and mass number"],
        ["e⁻", "Electron"], ["p⁺", "Proton"], ["n⁰", "Neutron"], ["CO₂", "Carbon dioxide"], ["NH₃", "Ammonia"],
        ["H₂SO₄", "Sulfuric acid"], ["Al₂(SO₄)₃", "Aluminium sulfate"]]),
    ]),
    sec("reaction", "3. Reaction and state symbols", list("cr", [
      ["→", "Produces / yields"], ["⇌", "Reversible reaction / equilibrium"], ["+", "Reacts with"], ["Δ", "Heat supplied (above arrow)"],
      ["↑", "Gas evolved"], ["↓", "Precipitate formed"], ["(s)", "Solid"], ["(l)", "Liquid"], ["(g)", "Gas"], ["(aq)", "Aqueous solution"],
      ["hν", "Light energy (photochemical)"], ["2H₂ + O₂ → 2H₂O", "Example: forming water"],
      ["N₂(g) + 3H₂(g) ⇌ 2NH₃(g)", "Example: Haber process"]])),
    sec("ions", "4. Ions and polyatomic ions", list("ci", [
      ["H⁺", "Hydrogen ion"], ["H₃O⁺", "Hydronium ion"], ["OH⁻", "Hydroxide ion"], ["NH₄⁺", "Ammonium ion"], ["NO₃⁻", "Nitrate ion"],
      ["NO₂⁻", "Nitrite ion"], ["SO₄²⁻", "Sulfate ion"], ["SO₃²⁻", "Sulfite ion"], ["CO₃²⁻", "Carbonate ion"], ["HCO₃⁻", "Hydrogen carbonate ion"],
      ["PO₄³⁻", "Phosphate ion"], ["HPO₄²⁻", "Hydrogen phosphate ion"], ["H₂PO₄⁻", "Dihydrogen phosphate ion"], ["CH₃COO⁻", "Ethanoate ion"],
      ["MnO₄⁻", "Permanganate ion"], ["CrO₄²⁻", "Chromate ion"], ["Cr₂O₇²⁻", "Dichromate ion"], ["CN⁻", "Cyanide ion"], ["O₂²⁻", "Peroxide ion"],
      ["S₂O₃²⁻", "Thiosulfate ion"], ["Li⁺", "Lithium ion"], ["Na⁺", "Sodium ion"], ["K⁺", "Potassium ion"], ["Mg²⁺", "Magnesium ion"],
      ["Ca²⁺", "Calcium ion"], ["Al³⁺", "Aluminium ion"], ["Zn²⁺", "Zinc ion"], ["Fe²⁺", "Iron(II) ion"], ["Fe³⁺", "Iron(III) ion"],
      ["Cu⁺", "Copper(I) ion"], ["Cu²⁺", "Copper(II) ion"], ["Cl⁻", "Chloride ion"], ["Br⁻", "Bromide ion"], ["I⁻", "Iodide ion"],
      ["O²⁻", "Oxide ion"], ["S²⁻", "Sulfide ion"]])),
    sec("atomic", "5. Atomic structure and isotopes", [
      r("ca_Z", "Z", "Atomic number (protons)"), r("ca_A", "A", "Mass number (protons + neutrons)", undefined, ["Absorbance", "Arrhenius factor"]),
      r("ca_N", "N", "Number of neutrons"), r("ca_nuc", "ᴬ_Z X", "Nuclide notation"),
      r("ca_orb", "s, p, d, f", "Orbitals / subshells"), r("ca_q", "n, l, mₗ, mₛ", "Quantum numbers"),
    ]),
    sec("acids", "6. Acids, bases and equilibrium", [
      e("cab_ph", "pH", "Hydrogen-ion activity measure"), e("cab_poh", "pOH", "Hydroxide-ion activity measure"),
      r("cab_ka", "Kₐ", "Acid dissociation constant"), r("cab_kb", "K_b", "Base dissociation constant"),
      r("cab_kw", "K_w", "Ionic product of water"), r("cab_kc", "K_c", "Equilibrium constant (concentrations)"),
      r("cab_kp", "K_p", "Equilibrium constant (partial pressures)"), r("cab_Q", "Q", "Reaction quotient"),
      r("cab_ksp", "K_sp", "Solubility product"), r("cab_pka", "pKₐ", "−log Kₐ"),
      r("cab_H", "[H⁺]", "Hydrogen-ion concentration"), r("cab_OH", "[OH⁻]", "Hydroxide-ion concentration"),
    ]),
    sec("moles", "7. Mole calculations and quantities", [
      r("cm_n", "n", "Amount of substance", "mol"), r("cm_m", "m", "Mass", "g or kg"), r("cm_M", "M", "Molar mass", "g mol⁻¹"),
      r("cm_c", "c", "Amount concentration", "mol dm⁻³"), r("cm_V", "V", "Volume", "dm³, cm³ or m³"), r("cm_N", "N", "Number of particles"),
      r("cm_NA", "Nₐ", "Avogadro constant", "mol⁻¹"), r("cm_p", "p", "Pressure", "Pa"), r("cm_T", "T", "Absolute temperature", "K"),
      r("cm_R", "R", "Gas constant", "J mol⁻¹ K⁻¹"), r("cm_Vm", "Vₘ", "Molar volume", "dm³ mol⁻¹"),
      r("cm_Mr", "Mᵣ", "Relative molecular mass"), r("cm_Ar", "Aᵣ", "Relative atomic mass"),
      e("cm_eq1", "n = m/M", "Moles from mass"), e("cm_eq2", "c = n/V", "Concentration"), e("cm_eq3", "N = nNₐ", "Particles"),
      e("cm_eq4", "pV = nRT", "Ideal gas equation"),
    ]),
    sec("energetics", "8. Thermochemistry and energetics", [
      r("ce_dH", "ΔH", "Enthalpy change", "kJ mol⁻¹"), r("ce_dHf", "ΔH_f°", "Standard enthalpy of formation", "kJ mol⁻¹"),
      r("ce_dHc", "ΔH_c°", "Standard enthalpy of combustion", "kJ mol⁻¹"), r("ce_dHr", "ΔH_r", "Enthalpy change of reaction", "kJ mol⁻¹"),
      r("ce_dS", "ΔS", "Entropy change", "J K⁻¹ mol⁻¹"), r("ce_dG", "ΔG", "Gibbs energy change", "kJ mol⁻¹"),
      r("ce_q", "q", "Heat transferred", "J"), r("ce_c", "c", "Specific heat capacity", "J g⁻¹ K⁻¹"), r("ce_C", "C", "Heat capacity", "J K⁻¹"),
      r("ce_Ea", "Eₐ", "Activation energy", "kJ mol⁻¹"), r("ce_dU", "ΔU", "Change in internal energy", "J"),
      r("ce_h", "h", "Planck constant", "J s"), r("ce_kB", "k_B", "Boltzmann constant", "J K⁻¹"),
      e("ce_eq", "q = mcΔT", "Heat energy calculation"),
    ]),
    sec("kinetics", "9. Rates of reaction and kinetics", [
      r("ck_r", "r", "Reaction rate", "mol dm⁻³ s⁻¹"), r("ck_k", "k", "Rate constant"), r("ck_t", "t", "Time", "s"),
      r("ck_A", "[A]", "Concentration of species A", "mol dm⁻³"), r("ck_half", "t½", "Half-life", "s"),
      r("ck_Af", "A", "Pre-exponential factor (Arrhenius)", undefined, ["Mass number", "Absorbance"]),
      e("ck_arr", "k = Ae^(−Eₐ/RT)", "Arrhenius equation"),
    ]),
    sec("electro", "10. Electrochemistry", [
      r("cel_E", "E°", "Standard electrode potential", "V"), r("cel_Ecell", "E°cell", "Standard cell potential", "V"),
      r("cel_I", "I", "Electric current", "A"), r("cel_Q", "Q", "Electric charge", "C"), r("cel_F", "F", "Faraday constant", "C mol⁻¹"),
      r("cel_z", "z", "Charge number"), r("cel_eta", "η", "Overpotential", "V"), r("cel_kappa", "κ", "Conductivity", "S m⁻¹"),
      e("cel_eq", "Q = It", "Charge passed"),
    ]),
    sec("organic", "11. Organic chemistry notation", list("co", [
      ["R", "General organic group"], ["R′", "Second organic group"], ["Ar", "Aryl group"], ["Ph", "Phenyl group"], ["Me", "Methyl group"],
      ["Et", "Ethyl group"], ["Pr", "Propyl group"], ["Bu", "Butyl group"], ["X", "Halogen substituent"], ["–", "Single bond"],
      ["=", "Double bond"], ["≡", "Triple bond"], ["δ+", "Partial positive charge"], ["δ−", "Partial negative charge"],
      ["cis / trans", "Geometric isomers"], ["R / S", "Absolute configuration"], ["E / Z", "Alkene stereochemistry"],
      ["↷", "Curved arrow: electron movement"]])),
    sec("spectro", "12. Spectroscopy and analysis", [
      r("cs_A", "A", "Absorbance"), r("cs_T", "T", "Transmittance", undefined, ["Temperature"]), r("cs_l", "λ", "Wavelength", "nm"),
      r("cs_nu", "ν", "Frequency", "Hz"), r("cs_nut", "ν̃", "Wavenumber", "cm⁻¹"), r("cs_eps", "ε", "Molar absorption coefficient"),
      r("cs_path", "l", "Path length", "cm"), r("cs_I0", "I₀", "Incident intensity"), r("cs_I", "I", "Transmitted intensity"),
      r("cs_mz", "m/z", "Mass-to-charge ratio"), r("cs_delta", "δ", "Chemical shift (NMR)", "ppm"), r("cs_J", "J", "Coupling constant", "Hz"),
      r("cs_Rf", "R_f", "Retention factor"), r("cs_tR", "t_R", "Retention time", "s"), e("cs_bl", "A = εlc", "Beer–Lambert law"),
    ]),
    sec("units", "13. Units and mathematical symbols", list("cu", [
      ["mol", "Mole"], ["g", "Gram"], ["kg", "Kilogram"], ["dm³", "Cubic decimetre"], ["cm³", "Cubic centimetre"], ["m³", "Cubic metre"],
      ["mol dm⁻³", "Concentration unit"], ["g mol⁻¹", "Molar mass unit"], ["K", "Kelvin"], ["°C", "Degree Celsius"], ["Pa", "Pascal"],
      ["kPa", "Kilopascal"], ["atm", "Atmosphere"], ["J", "Joule"], ["kJ", "Kilojoule"], ["kJ mol⁻¹", "Molar energy"], ["s", "Second"],
      ["min", "Minute"], ["A", "Ampere"], ["C", "Coulomb"], ["V", "Volt"], ["Ω", "Ohm"], ["S m⁻¹", "Conductivity unit"], ["nm", "Nanometre"],
      ["pm", "Picometre"], ["Å", "Ångström"], ["≈", "Approximately equal"], ["∝", "Proportional to"], ["Σ", "Summation"], ["Δ", "Change in"],
      ["log", "Logarithm (base 10)"], ["ln", "Natural logarithm"]])),
    sec("apparatus", "14. Laboratory apparatus", APPARATUS.map((a, i) => e(`cap_${i}`, a, `${a} diagram`, undefined, { status: "pending" })),
      "Drawn apparatus diagrams are pending artwork."),
    sec("hazards", "15. GHS hazard pictograms", HAZARDS.map((h, i) => e(`chz_${i}`, h, `GHS pictogram: ${h}`, undefined, { status: "pending" })),
      "Accurate pictograms are pending artwork; never replaced by emoji."),
  ],
};
