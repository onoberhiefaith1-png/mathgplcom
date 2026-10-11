// CHEMISTRY VALIDATOR — deterministic, no AI. Parses chemical formulae and
// equations, checks element symbols, atom conservation and charge balance.
// Pure TypeScript with no dependencies so the app and Copilot share one copy.

export const ELEMENT_SYMBOLS = new Set((
  "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr " +
  "Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb " +
  "Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf " +
  "Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og"
).split(" "));

const SUB = "₀₁₂₃₄₅₆₇₈₉";
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** Unicode / LaTeX-ish / caret forms → plain ASCII ("SO4^2-", "H2O"). */
export function normaliseChem(raw: string): string {
  let s = String(raw ?? "");
  s = s.replace(/\\mathrm\{([^}]*)\}/g, "$1").replace(/\\ce\{([^}]*)\}/g, "$1");
  s = s.replace(/\\rightarrow|\\longrightarrow|→|⟶|-->|->/g, " -> ");
  s = s.replace(/\\rightleftharpoons|⇌|<=>/g, " -> ");
  s = s.replace(/_\{?(\d+)\}?/g, "$1");
  s = s.replace(/[₀-₉]/g, (c) => String(SUB.indexOf(c)));
  // superscript charge run: ²⁻, ⁺, ³⁺
  s = s.replace(/([⁰-⁹¹²³]*)([⁺⁻])/g, (_m, d: string, sign: string) =>
    "^" + [...d].map((c) => String(SUP.indexOf(c))).join("") + (sign === "⁺" ? "+" : "-"));
  s = s.replace(/\^\{([^}]*)\}/g, "^$1");
  s = s.replace(/\\,|\\ /g, " ");
  return s;
}

export interface Species { counts: Record<string, number>; charge: number; unknown: string[] }

/** Parse one species such as "2Fe2(SO4)3(aq)" or "SO4^2-". Coefficient included. */
export function parseSpecies(raw: string): Species | null {
  let s = normaliseChem(raw).trim().replace(/\((aq|s|l|g)\)$/i, "").trim();
  if (!s) return null;
  let coef = 1;
  const cm = s.match(/^(\d+)\s*(?=[A-Z(\[])/);
  if (cm) { coef = Number(cm[1]); s = s.slice(cm[0].length); }
  let charge = 0;
  const ch = s.match(/\^(\d*)([+-])$/);
  if (ch) { charge = (ch[1] ? Number(ch[1]) : 1) * (ch[2] === "+" ? 1 : -1); s = s.slice(0, ch.index); }
  const unknown: string[] = [];
  let i = 0;
  const group = (): Record<string, number> | null => {
    const out: Record<string, number> = {};
    while (i < s.length) {
      const c = s[i];
      if (c === "(" || c === "[") {
        i++;
        const inner = group();
        if (!inner || (s[i] !== ")" && s[i] !== "]")) return null;
        i++;
        const n = readNum();
        for (const [k, v] of Object.entries(inner)) out[k] = (out[k] ?? 0) + v * n;
      } else if (c === ")" || c === "]") {
        return out;
      } else if (c === "·" || c === ".") {
        i++;
        const n = readNum();
        const rest = group();
        if (!rest) return null;
        for (const [k, v] of Object.entries(rest)) out[k] = (out[k] ?? 0) + v * n;
        return out;
      } else if (/[A-Z]/.test(c)) {
        let sym = c; i++;
        if (/[a-z]/.test(s[i] ?? "")) { sym += s[i]; i++; }
        if (!ELEMENT_SYMBOLS.has(sym)) unknown.push(sym);
        const n = readNum();
        out[sym] = (out[sym] ?? 0) + n;
      } else return null;
    }
    return out;
  };
  const readNum = (): number => {
    let j = i;
    while (/\d/.test(s[j] ?? "")) j++;
    const n = j > i ? Number(s.slice(i, j)) : 1;
    i = j;
    return n;
  };
  const counts = group();
  if (!counts || i !== s.length || Object.keys(counts).length === 0) return null;
  for (const k of Object.keys(counts)) counts[k] *= coef;
  return { counts, charge: charge * coef, unknown };
}

export interface EquationCheck {
  ok: boolean;
  balancedAtoms: boolean;
  balancedCharge: boolean;
  unknownElements: string[];
  problems: string[];
}

function sideTotals(side: string) {
  const counts: Record<string, number> = {};
  let charge = 0;
  const unknown: string[] = [];
  // electrons in half-equations: "2e-", "2e⁻"
  const parts = side.split(/\s\+\s|\s\+(?=\s*\d*\s*[A-Z(e])/).map((p) => p.trim()).filter(Boolean);
  for (const p of parts) {
    const e = p.match(/^(\d*)\s*e(\^?-|⁻)?$/);
    if (e) { charge -= e[1] ? Number(e[1]) : 1; continue; }
    const sp = parseSpecies(p);
    if (!sp) return null;
    for (const [k, v] of Object.entries(sp.counts)) counts[k] = (counts[k] ?? 0) + v;
    charge += sp.charge;
    unknown.push(...sp.unknown);
  }
  return { counts, charge, unknown };
}

/** Check a chemical equation: real elements, atoms conserved, charge conserved. */
export function checkEquation(raw: string): EquationCheck | null {
  const s = normaliseChem(raw);
  const sides = s.split(/\s->\s/);
  if (sides.length !== 2) return null;
  const L = sideTotals(sides[0]);
  const R = sideTotals(sides[1]);
  if (!L || !R) return null;
  const problems: string[] = [];
  const els = new Set([...Object.keys(L.counts), ...Object.keys(R.counts)]);
  let balancedAtoms = true;
  for (const el of els) {
    if ((L.counts[el] ?? 0) !== (R.counts[el] ?? 0)) {
      balancedAtoms = false;
      problems.push(`${el}: ${L.counts[el] ?? 0} on the left, ${R.counts[el] ?? 0} on the right`);
    }
  }
  const balancedCharge = L.charge === R.charge;
  if (!balancedCharge) problems.push(`charge: ${L.charge} on the left, ${R.charge} on the right`);
  const unknownElements = [...new Set([...L.unknown, ...R.unknown])];
  for (const u of unknownElements) problems.push(`"${u}" is not an element symbol`);
  return { ok: balancedAtoms && balancedCharge && unknownElements.length === 0, balancedAtoms, balancedCharge, unknownElements, problems };
}

/** Find equation-looking lines in text and report the ones that fail. */
export function findChemistryProblems(text: string): Array<{ line: string; problems: string[] }> {
  const out: Array<{ line: string; problems: string[] }> = [];
  for (const line of String(text ?? "").split(/\n/)) {
    if (!/→|->|\\rightarrow|⇌/.test(line)) continue;
    const candidate = line.replace(/^[^A-Z0-9\\(]*/, "").replace(/[.;,]\s*$/, "");
    const r = checkEquation(candidate);
    if (r && !r.ok) out.push({ line: line.trim(), problems: r.problems });
  }
  return out;
}

/** Molar mass helper used for mole-calculation checks. */
export const ATOMIC_MASS: Record<string, number> = {
  H: 1, He: 4, C: 12, N: 14, O: 16, F: 19, Ne: 20, Na: 23, Mg: 24, Al: 27, Si: 28, P: 31, S: 32,
  Cl: 35.5, Ar: 40, K: 39, Ca: 40, Fe: 56, Cu: 63.5, Zn: 65, Br: 80, Ag: 108, I: 127, Ba: 137, Pb: 207,
};
export function molarMass(formula: string): number | null {
  const sp = parseSpecies(formula);
  if (!sp) return null;
  let m = 0;
  for (const [k, v] of Object.entries(sp.counts)) {
    if (ATOMIC_MASS[k] == null) return null;
    m += ATOMIC_MASS[k] * v;
  }
  return Math.round(m * 100) / 100;
}
