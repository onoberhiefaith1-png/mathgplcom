// Physics library: the 17 sections of the supplied Physics Symbol
// specification. Core quantities come from the existing PHYSICS_SYMBOLS
// (shared with Copilot) so meanings never fork.
import { PHYSICS_SYMBOLS } from "../physics";
import type { SubjectEntry, SubjectLibrary, SubjectSection } from "./types";

const e = (id: string, symbol: string, meaning: string, unit?: string, alsoMeans?: string[]): SubjectEntry =>
  ({ id, symbol, meaning, unit, alsoMeans });

const fromCore = (topic: string): SubjectEntry[] =>
  PHYSICS_SYMBOLS.filter((s) => s.topic === topic).map((s) =>
    e(`ph_${s.id}`, s.symbol, s.meaning, s.unit, s.alsoMeans));

const pick = (...ids: string[]): SubjectEntry[] =>
  ids.map((id) => PHYSICS_SYMBOLS.find((s) => s.id === id)!).filter(Boolean)
    .map((s) => e(`ph_${s.id}`, s.symbol, s.meaning, s.unit, s.alsoMeans));

const sec = (id: string, name: string, entries: SubjectEntry[]): SubjectSection => ({ id, name, entries });

const mech = fromCore("Mechanics");
const motionIds = new Set(["ph_s", "ph_d", "ph_t", "ph_u", "ph_v", "ph_a", "ph_g", "ph_h", "ph_m", "ph_F", "ph_Fnet", "ph_R", "ph_T", "ph_mu", "ph_k", "ph_x"]);

export const PHYSICS_LIBRARY: SubjectLibrary = {
  id: "physics",
  name: "Physics",
  status: "ready",
  sections: [
    sec("mechanics", "1. Mechanics: motion and forces", [
      ...mech.filter((x) => motionIds.has(x.id)),
      e("phx_v_eq", "v = u + at", "First equation of motion"),
      e("phx_s_eq", "s = ut + ½at²", "Second equation of motion"),
      e("phx_F_eq", "F = ma", "Newton's second law"),
    ]),
    sec("energy", "2. Energy, work and power", [
      ...fromCore("Energy"),
      e("phx_Ek_eq", "Eₖ = ½mv²", "Kinetic energy formula"),
      e("phx_Ep_eq", "Eₚ = mgh", "Gravitational potential energy"),
      e("phx_P_eq", "P = W/t", "Power formula"),
    ]),
    sec("momentum", "3. Momentum, collisions and rotation", [
      ...mech.filter((x) => ["ph_p", "ph_J", "ph_tau", "ph_omega", "ph_alpha", "ph_I_inertia"].includes(x.id)),
      e("phx_p_eq", "p = mv", "Momentum formula"),
      e("phx_e_rest", "e", "Coefficient of restitution", "—"),
    ]),
    sec("gravitation", "4. Gravitation and circular motion", [
      ...pick("G", "g", "omega"),
      e("phx_r_orb", "r", "Orbital radius", "m"),
      e("phx_ac", "a꜀", "Centripetal acceleration", "m/s²"),
      e("phx_Fc", "F꜀", "Centripetal force", "N"),
      e("phx_grav_eq", "F = Gm₁m₂/r²", "Newton's law of gravitation"),
    ]),
    sec("matter", "5. Matter, density, pressure and fluids", [
      ...fromCore("Fluids"),
      ...pick("p"),
      e("phx_rho_eq", "ρ = m/V", "Density formula"),
      e("phx_p_eq2", "p = F/A", "Pressure formula"),
      e("phx_hrg", "p = hρg", "Pressure in a liquid"),
    ]),
    sec("thermal", "6. Thermal physics and thermodynamics", [
      ...fromCore("Thermal"),
      e("phx_Q_eq", "Q = mcΔθ", "Heat energy formula"),
      e("phx_gas", "pV = nRT", "Ideal gas equation"),
    ]),
    sec("electricity", "7. Electricity and electric fields", [
      ...fromCore("Electricity"),
      e("phx_V_IR", "V = IR", "Ohm's law"),
      e("phx_Q_It", "Q = It", "Charge formula"),
      e("phx_P_IV", "P = IV", "Electrical power"),
    ]),
    sec("circuits", "8. Circuit components and diagram notation", [
      e("phc_cell", "cell", "Cell symbol"), e("phc_battery", "battery", "Battery symbol"),
      e("phc_resistor", "resistor", "Fixed resistor"), e("phc_variable", "variable resistor", "Rheostat"),
      e("phc_lamp", "lamp", "Filament lamp"), e("phc_switch", "switch", "Open / closed switch"),
      e("phc_ammeter", "Ⓐ", "Ammeter"), e("phc_voltmeter", "Ⓥ", "Voltmeter"),
      e("phc_diode", "diode", "Diode"), e("phc_led", "LED", "Light-emitting diode"),
      e("phc_ldr", "LDR", "Light-dependent resistor"), e("phc_thermistor", "thermistor", "Thermistor"),
      e("phc_fuse", "fuse", "Fuse"), e("phc_capacitor", "capacitor", "Capacitor"),
      e("phc_earth", "earth", "Earth connection"),
    ].map((x) => ({ ...x, status: "pending" as const }))),
    sec("magnetism", "9. Magnetism and electromagnetic induction", [
      ...fromCore("Magnetism"),
      e("phx_F_BIL", "F = BIL", "Force on a current-carrying conductor"),
      e("phx_flux", "Φ = BA", "Magnetic flux"),
      e("phx_trans", "Vₚ/Vₛ = Nₚ/Nₛ", "Transformer equation"),
    ]),
    sec("waves", "10. Waves, sound and oscillations", [
      ...fromCore("Waves"),
      e("phx_wave_eq", "v = fλ", "Wave equation"),
      e("phx_fT", "f = 1/T", "Frequency and period"),
    ]),
    sec("light", "11. Light, optics and lenses", [
      ...fromCore("Optics"),
      e("phx_snell", "n = sin i / sin r", "Snell's law"),
      e("phx_lens", "1/f = 1/u + 1/v", "Lens formula"),
    ]),
    sec("em", "12. Electromagnetic waves", [
      e("phx_c", "c", "Speed of light", "m/s"),
      e("phx_c_eq", "c = fλ", "Electromagnetic wave equation"),
      e("phx_E0", "E₀", "Electric field amplitude", "V/m"),
      e("phx_B0", "B₀", "Magnetic field amplitude", "T"),
    ]),
    sec("atomic", "13. Atomic, nuclear and quantum physics", [
      ...fromCore("Atomic"),
      e("phx_Ehf", "E = hf", "Photon energy"),
      e("phx_mc2", "E = mc²", "Mass–energy equivalence"),
    ]),
    sec("relativity", "14. Relativity and advanced physics", [
      e("phx_gamma_rel", "γ", "Lorentz factor", "—"),
      e("phx_t0", "t₀", "Proper time", "s"),
      e("phx_L0", "L₀", "Proper length", "m"),
      e("phx_m0", "m₀", "Rest mass", "kg"),
      e("phx_beta_rel", "β = v/c", "Speed ratio"),
    ]),
    sec("greek", "15. Greek letters used in physics", [
      ["α", "Alpha"], ["β", "Beta"], ["γ", "Gamma"], ["δ", "delta"], ["Δ", "Delta (change)"], ["ε", "Epsilon"],
      ["η", "Eta"], ["θ", "Theta"], ["λ", "Lambda"], ["μ", "Mu"], ["ν", "Nu"], ["π", "Pi"], ["ρ", "Rho"],
      ["σ", "Sigma"], ["τ", "Tau"], ["φ", "Phi"], ["Φ", "Capital Phi"], ["ω", "Omega"], ["Ω", "Capital Omega"],
    ].map(([s, m], i) => e(`phg_${i}`, s, m))),
    sec("operators", "16. Mathematical operators and notation", [
      ["Δ", "Change in"], ["Σ", "Sum of"], ["∝", "Proportional to"], ["≈", "Approximately equal"],
      ["→", "Tends to / vector"], ["∫", "Integral"], ["d/dt", "Rate of change with time"], ["√", "Square root"],
      ["×", "Multiply / cross product"], ["·", "Dot product"], ["|x|", "Magnitude"],
    ].map(([s, m], i) => e(`pho_${i}`, s, m))),
    sec("si", "17. SI units and prefixes", [
      ...["m", "kg", "s", "A", "K", "mol", "cd"].map((u, i) => e(`phs_${i}`, u, "SI base unit", u)),
      ...[["T", "tera 10¹²"], ["G", "giga 10⁹"], ["M", "mega 10⁶"], ["k", "kilo 10³"], ["c", "centi 10⁻²"],
        ["m", "milli 10⁻³"], ["µ", "micro 10⁻⁶"], ["n", "nano 10⁻⁹"], ["p", "pico 10⁻¹²"]]
        .map(([s, m], i) => e(`php_${i}`, s, `Prefix: ${m}`)),
    ]),
  ],
};
