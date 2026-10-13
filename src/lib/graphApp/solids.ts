/** Dimensioned solids: one validated specification drives both geometry and maths. */
export type SolidKind = "cube" | "cuboid" | "sphere" | "cylinder" | "cone";
export type SolidUnit = "mm" | "cm" | "m";
export interface Solid { kind: SolidKind; unit: SolidUnit; dimensions: number[]; source: string }
export interface SolidMeasure { label: string; value: number; power: number; formula: string; working: string }
export const SOLID_FIELDS: Record<SolidKind, string[]> = {
  cube: ["Side"], cuboid: ["Length", "Width", "Height"], sphere: ["Radius"], cylinder: ["Radius", "Height"], cone: ["Radius", "Height"],
};
const factors: Record<SolidUnit, number> = { mm: 0.001, cm: 0.01, m: 1 };
export const fmtSolid = (n: number) => Number(n.toPrecision(7)).toString();
export function validSolid(s: unknown): s is Solid {
  if (!s || typeof s !== "object") return false;
  const v = s as Solid;
  return Object.hasOwn(SOLID_FIELDS, v.kind) && Object.hasOwn(factors, v.unit) && typeof v.source === "string" && v.source.length <= 2000 && Array.isArray(v.dimensions) && v.dimensions.length === SOLID_FIELDS[v.kind].length && v.dimensions.every(n => Number.isFinite(n) && n > 0 && n <= 1e9) && Math.min(...v.dimensions) / Math.max(...v.dimensions) >= 1e-6;
}
export function parseSolid(input: string): Solid | null {
  const src = input.trim();
  const shape = src.match(/\b(cube|cuboid|rectangular prism|sphere|cylinder|cone)\b/i);
  if (!shape) return null;
  const kind = (shape[1].toLowerCase() === "rectangular prism" ? "cuboid" : shape[1].toLowerCase()) as SolidKind;
  const rest = src.slice((shape.index ?? 0) + shape[0].length).replace(/\b(?:with|a|an|of|and|by)\b/gi, " ").replace(/[×,]/g, " ").replace(/\bx\b/gi, " ");
  const re = /(?:(side|length|width|height|radius|diameter)\s*(?:=|:)?\s*)?(-?\d+(?:\.\d+)?|\.\d+)\s*(millimet(?:er|re)s?|centimet(?:er|re)s?|met(?:er|re)s?|mm|cm|m)?\b/gi;
  const entries = [...rest.matchAll(re)];
  const unknown = rest.replace(re, "").replace(/[\s=:.-]/g, "");
  if (unknown || !entries.length) throw Error(`Enter ${kind} with ${SOLID_FIELDS[kind].join(" and ").toLowerCase()}, for example ${solidExample(kind)}.`);
  const unitOf = (u: string): SolidUnit => /^mm|milli/i.test(u) ? "mm" : /^cm|centi/i.test(u) ? "cm" : "m";
  const unit = unitOf(entries.find(e => e[3])?.[3] ?? "cm");
  const values = entries.map(e => ({ label: e[1]?.toLowerCase(), n: Number(e[2]) * factors[e[3] ? unitOf(e[3]) : unit] / factors[unit] }));
  const fields = SOLID_FIELDS[kind].map(s => s.toLowerCase());
  if (values.length !== fields.length) throw Error(`${kind} needs ${fields.join(" and ")} exactly once.`);
  let dimensions: number[];
  if (values.some(v => v.label)) {
    if (values.some(v => !v.label || (!fields.includes(v.label) && !(v.label === "diameter" && fields.includes("radius"))))) throw Error(`Use ${fields.join(" and ")} for ${kind}.`);
    dimensions = fields.map(field => {
      const candidates = values.filter(v => v.label === field || (field === "radius" && v.label === "diameter"));
      if (candidates.length !== 1) throw Error(`Specify ${field} exactly once.`);
      return candidates[0].n / (candidates[0].label === "diameter" ? 2 : 1);
    });
  } else dimensions = values.map(v => v.n);
  const solid: Solid = { kind, unit, dimensions, source: src };
  if (!validSolid(solid)) throw Error("Dimensions must be finite, positive, and have a ratio of at least one in a million.");
  return solid;
}
export function solidExample(kind: SolidKind): string {
  return { cube: "cube with side 5 cm", cuboid: "cuboid 3 by 4 by 5 cm", sphere: "sphere radius 3 cm", cylinder: "cylinder radius 3 cm height 5 cm", cone: "cone radius 3 cm height 4 cm" }[kind];
}
export function solidMeasures(s: Solid): SolidMeasure[] {
  if (!validSolid(s)) throw Error("Invalid solid dimensions.");
  const [a, b, c] = s.dimensions, f = fmtSolid;
  const out: SolidMeasure[] = [];
  const add = (label: string, value: number, power: number, formula: string, working: string) => out.push({ label, value, power, formula, working });
  if (s.kind === "cube" || s.kind === "cuboid") {
    const l = a, w = s.kind === "cube" ? a : b, h = s.kind === "cube" ? a : c;
    add("Volume", l*w*h, 3, "V = l × w × h", `V = ${f(l)} × ${f(w)} × ${f(h)}`);
    add("Surface area", 2*(l*w+l*h+w*h), 2, "A = 2(lw + lh + wh)", `A = 2(${f(l)} × ${f(w)} + ${f(l)} × ${f(h)} + ${f(w)} × ${f(h)})`);
    add("Space diagonal", Math.hypot(l,w,h), 1, "d² = l² + w² + h²", `d = √(${f(l)}² + ${f(w)}² + ${f(h)}²)`);
    add("Base face diagonal", Math.hypot(l,w), 1, "f² = l² + w²", `f = √(${f(l)}² + ${f(w)}²)`);
  } else if (s.kind === "sphere") {
    add("Volume", 4*Math.PI*a**3/3, 3, "V = ⁴⁄₃πr³", `V = ⁴⁄₃ × π × ${f(a)}³`);
    add("Surface area", 4*Math.PI*a*a, 2, "A = 4πr²", `A = 4 × π × ${f(a)}²`);
    add("Diameter", 2*a, 1, "d = 2r", `d = 2 × ${f(a)}`);
  } else {
    const slant = Math.hypot(a,b);
    add("Volume", Math.PI*a*a*b/(s.kind === "cone" ? 3 : 1), 3, s.kind === "cone" ? "V = ⅓πr²h" : "V = πr²h", `V = ${s.kind === "cone" ? "⅓ × " : ""}π × ${f(a)}² × ${f(b)}`);
    add("Surface area", s.kind === "cone" ? Math.PI*a*(a+slant) : 2*Math.PI*a*(a+b), 2, s.kind === "cone" ? "A = πr(r + s)" : "A = 2πr(r + h)", s.kind === "cone" ? `A = π × ${f(a)} × (${f(a)} + √(${f(a)}² + ${f(b)}²))` : `A = 2 × π × ${f(a)} × (${f(a)} + ${f(b)})`);
    if (s.kind === "cone") add("Slant height", slant, 1, "s² = r² + h²", `s = √(${f(a)}² + ${f(b)}²)`);
    else add("Axial-section diagonal", Math.hypot(2*a,b), 1, "d² = (2r)² + h²", `d = √(${f(2*a)}² + ${f(b)}²)`);
  }
  return out;
}