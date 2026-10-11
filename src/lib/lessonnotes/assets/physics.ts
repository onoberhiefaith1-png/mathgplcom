import type { AssetDef } from "./types";

/** One Physics quantity: symbol, meaning, SI unit, topic group, other meanings. */
export interface PhysicsSymbol {
  id: string;
  symbol: string;
  meaning: string;
  unit: string;
  topic: string;
  /** Other meanings in other topics, e.g. T is also period / temperature. */
  alsoMeans?: string[];
}

const P = (id: string, symbol: string, meaning: string, unit: string, topic: string, alsoMeans?: string[]): PhysicsSymbol =>
  ({ id, symbol, meaning, unit, topic, alsoMeans });

export const PHYSICS_SYMBOLS: PhysicsSymbol[] = [
  // Mechanics
  P("s", "s", "Displacement / distance", "m", "Mechanics"),
  P("d", "d", "Distance or separation", "m", "Mechanics"),
  P("t", "t", "Time", "s", "Mechanics"),
  P("u", "u", "Initial velocity", "m/s", "Mechanics"),
  P("v", "v", "Final velocity", "m/s", "Mechanics"),
  P("a", "a", "Acceleration", "m/s²", "Mechanics"),
  P("g", "g", "Acceleration due to gravity", "m/s²", "Mechanics"),
  P("h", "h", "Height", "m", "Mechanics"),
  P("m", "m", "Mass", "kg", "Mechanics"),
  P("F", "F", "Force", "N", "Mechanics"),
  P("Fnet", "Fₙₑₜ", "Resultant force", "N", "Mechanics"),
  P("R", "R", "Normal reaction", "N", "Mechanics", ["Resistance (Ω)"]),
  P("T", "T", "Tension", "N", "Mechanics", ["Period (s)", "Temperature (K)"]),
  P("mu", "μ", "Coefficient of friction", "—", "Mechanics", ["Permeability"]),
  P("k", "k", "Spring constant", "N/m", "Mechanics"),
  P("x", "x", "Extension", "m", "Mechanics"),
  P("p", "p", "Momentum", "kg·m/s", "Mechanics", ["Pressure (Pa)"]),
  P("J", "J", "Impulse", "N·s", "Mechanics"),
  P("tau", "τ", "Torque / moment", "N·m", "Mechanics"),
  P("omega", "ω", "Angular velocity", "rad/s", "Mechanics"),
  P("alpha", "α", "Angular acceleration", "rad/s²", "Mechanics"),
  P("I_inertia", "I", "Moment of inertia", "kg·m²", "Mechanics", ["Current (A)"]),
  P("G", "G", "Gravitational constant", "N·m²/kg²", "Mechanics"),
  // Energy
  P("E", "E", "Energy", "J", "Energy"),
  P("Ek", "Eₖ", "Kinetic energy", "J", "Energy"),
  P("Ep", "Eₚ", "Potential energy", "J", "Energy"),
  P("W", "W", "Work done", "J", "Energy", ["Weight (N)"]),
  P("P", "P", "Power", "W", "Energy", ["Pressure (Pa)"]),
  P("eta", "η", "Efficiency", "%", "Energy"),
  P("MA", "MA", "Mechanical advantage", "—", "Energy"),
  P("VR", "VR", "Velocity ratio", "—", "Energy"),
  // Fluids
  P("rho", "ρ", "Density", "kg/m³", "Fluids", ["Resistivity (Ω·m)"]),
  P("V_vol", "V", "Volume", "m³", "Fluids", ["Potential difference (V)"]),
  P("A", "A", "Area", "m²", "Fluids"),
  P("U", "U", "Upthrust", "N", "Fluids", ["Internal energy (J)"]),
  // Thermal
  P("theta", "θ", "Temperature (Celsius)", "°C", "Thermal", ["Angle"]),
  P("Q_heat", "Q", "Heat energy", "J", "Thermal", ["Charge (C)"]),
  P("c", "c", "Specific heat capacity", "J/(kg·K)", "Thermal", ["Speed of light (m/s)"]),
  P("L", "L", "Specific latent heat", "J/kg", "Thermal", ["Inductance (H)", "Length (m)"]),
  P("dT", "ΔT", "Change in temperature", "K", "Thermal"),
  P("n", "n", "Amount of substance", "mol", "Thermal", ["Refractive index", "Number of turns"]),
  P("Rgas", "R", "Molar gas constant", "J/(mol·K)", "Thermal"),
  P("kB", "k_B", "Boltzmann constant", "J/K", "Thermal"),
  P("alphaLin", "α", "Linear expansivity", "K⁻¹", "Thermal"),
  P("gammaVol", "γ", "Cubic expansivity", "K⁻¹", "Thermal"),
  P("sigmaSB", "σ", "Stefan–Boltzmann constant", "W/(m²·K⁴)", "Thermal"),
  // Waves
  P("lambda", "λ", "Wavelength", "m", "Waves", ["Decay constant (s⁻¹)"]),
  P("f", "f", "Frequency", "Hz", "Waves", ["Focal length (m)"]),
  P("Tper", "T", "Period", "s", "Waves"),
  P("A_amp", "A", "Amplitude", "m", "Waves"),
  P("vwave", "v", "Wave speed", "m/s", "Waves"),
  // Optics
  P("i", "i", "Angle of incidence", "°", "Optics"),
  P("r", "r", "Angle of refraction", "°", "Optics"),
  P("n_ref", "n", "Refractive index", "—", "Optics"),
  P("f_focal", "f", "Focal length", "m", "Optics"),
  P("M", "M", "Magnification", "—", "Optics"),
  P("C_crit", "C", "Critical angle", "°", "Optics"),
  // Electricity
  P("Q", "Q", "Electric charge", "C", "Electricity"),
  P("I", "I", "Current", "A", "Electricity"),
  P("V", "V", "Potential difference", "V", "Electricity"),
  P("emf", "ε", "Electromotive force", "V", "Electricity"),
  P("R_res", "R", "Resistance", "Ω", "Electricity"),
  P("r_int", "r", "Internal resistance", "Ω", "Electricity"),
  P("C", "C", "Capacitance", "F", "Electricity", ["Heat capacity (J/K)"]),
  P("Efield", "E", "Electric field strength", "N/C", "Electricity"),
  P("e", "e", "Elementary charge", "C", "Electricity"),
  P("eps0", "ε₀", "Permittivity of free space", "F/m", "Electricity"),
  P("ke", "k", "Coulomb constant", "N·m²/C²", "Electricity"),
  P("ohm", "Ω", "Ohm (unit)", "Ω", "Electricity"),
  P("micro", "µ", "Micro- (10⁻⁶)", "—", "Electricity"),
  // Magnetism
  P("B", "B", "Magnetic flux density", "T", "Magnetism"),
  P("Phi", "Φ", "Magnetic flux", "Wb", "Magnetism"),
  P("N", "N", "Number of turns", "—", "Magnetism"),
  P("L_ind", "L", "Inductance", "H", "Magnetism"),
  P("mu0", "μ₀", "Permeability of free space", "H/m", "Magnetism"),
  // Atomic
  P("Z", "Z", "Proton (atomic) number", "—", "Atomic"),
  P("Anuc", "A", "Nucleon (mass) number", "—", "Atomic"),
  P("half", "t½", "Half-life", "s", "Atomic"),
  P("lambdaDecay", "λ", "Decay constant", "s⁻¹", "Atomic"),
  P("alphaP", "α", "Alpha particle", "—", "Atomic"),
  P("betaP", "β", "Beta particle", "—", "Atomic"),
  P("gammaR", "γ", "Gamma radiation", "—", "Atomic"),
  P("h_pl", "h", "Planck constant", "J·s", "Atomic"),
];

/** Units typed directly, written with proper symbols. */
export const PHYSICS_UNITS = [
  "m/s", "m/s²", "N", "N·m", "N·s", "J", "W", "Pa", "kg/m³", "J/(kg·K)", "J/kg",
  "K", "°C", "Hz", "Ω", "V", "A", "C", "F", "µF", "T", "Wb", "H", "K⁻¹", "s⁻¹", "mol",
];

export function findPhysicsSymbol(id: string): PhysicsSymbol | undefined {
  return PHYSICS_SYMBOLS.find((s) => s.id === id);
}

export const PHYSICS_ASSETS: AssetDef[] = [
  ...PHYSICS_SYMBOLS.map((s): AssetDef => ({
    id: `ph_${s.id}`,
    label: `${s.meaning} (${s.symbol})`,
    category: "Physics",
    group: s.topic,
    keywords: ["physics", s.symbol.toLowerCase(), s.meaning.toLowerCase(), s.unit.toLowerCase(), s.topic.toLowerCase(), ...(s.alsoMeans ?? []).map((m) => m.toLowerCase())],
    render: { kind: "symbol", char: s.symbol },
    hint: `${s.symbol} · ${s.unit}`,
  })),
  ...PHYSICS_UNITS.map((u, i): AssetDef => ({
    id: `phu_${i}`,
    label: `Unit ${u}`,
    category: "Physics",
    group: "Units",
    keywords: ["physics", "unit", u.toLowerCase()],
    render: { kind: "symbol", char: u },
    hint: u,
  })),
];
