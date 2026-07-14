import type { AssetDef } from "./types";

const sym = (id: string, label: string, char: string, group: string, keywords: string[] = []): AssetDef => ({
  id, label, category: "Symbols", group,
  keywords: [id, label.toLowerCase(), ...keywords],
  render: { kind: "symbol", char }, hint: char,
});

export const SYMBOLS: AssetDef[] = [
  // Basic operations & arithmetic
  sym("plus", "Plus", "+", "Basic"),
  sym("minus", "Minus", "−", "Basic"),
  sym("multiply", "Multiply", "×", "Basic", ["times"]),
  sym("dot", "Multiply dot", "·", "Basic", ["cdot"]),
  sym("divide", "Divide", "÷", "Basic"),
  sym("plusminus", "Plus-minus", "±", "Basic", ["pm"]),
  sym("mp", "Minus-plus", "∓", "Basic"),
  sym("percent", "Percent", "%", "Basic"),
  sym("prime", "Prime", "′", "Basic"),

  // Equalities & inequalities
  sym("equals", "Equals", "=", "Equalities"),
  sym("notequal", "Not equal", "≠", "Equalities", ["neq"]),
  sym("approx", "Approximately", "≈", "Equalities"),
  sym("identical", "Identical to", "≡", "Equalities", ["equiv", "congruent"]),
  sym("greater", "Greater than", ">", "Equalities"),
  sym("less", "Less than", "<", "Equalities"),
  sym("greaterequal", "Greater or equal", "≥", "Equalities", ["geq"]),
  sym("lessequal", "Less or equal", "≤", "Equalities", ["leq"]),
  sym("proportional", "Proportional to", "∝", "Equalities", ["propto"]),

  // Geometry
  sym("angle", "Angle", "∠", "Geometry"),
  sym("rightangle", "Right angle", "∟", "Geometry"),
  sym("degree", "Degree", "°", "Geometry"),
  sym("parallel", "Parallel", "∥", "Geometry"),
  sym("perpendicular", "Perpendicular", "⊥", "Geometry", ["perp"]),
  sym("similar", "Similar", "∼", "Geometry"),
  sym("congruent", "Congruent", "≅", "Geometry"),
  sym("trianglesym", "Triangle", "△", "Geometry"),
  sym("circlesym", "Circle", "◯", "Geometry"),
  sym("arc", "Arc", "⌒", "Geometry"),

  // Sets & number systems
  sym("elementof", "Element of", "∈", "Sets", ["in"]),
  sym("notelement", "Not element of", "∉", "Sets"),
  sym("subset", "Subset", "⊂", "Sets"),
  sym("subseteq", "Subset or equal", "⊆", "Sets"),
  sym("propersubset", "Proper subset", "⊊", "Sets"),
  sym("union", "Union", "∪", "Sets"),
  sym("intersect", "Intersection", "∩", "Sets", ["cap"]),
  sym("emptyset", "Empty set", "∅", "Sets"),
  sym("universalset", "Universal set", "𝒰", "Sets"),
  sym("reals", "Real numbers", "ℝ", "Sets"),
  sym("integers", "Integers", "ℤ", "Sets"),
  sym("rationals", "Rational numbers", "ℚ", "Sets"),
  sym("naturals", "Natural numbers", "ℕ", "Sets"),
  sym("complex", "Complex numbers", "ℂ", "Sets"),

  // Logic & proofs
  sym("therefore", "Therefore", "∴", "Logic"),
  sym("because", "Because", "∵", "Logic"),
  sym("implies", "Implies", "⇒", "Logic"),
  sym("iff", "If and only if", "⇔", "Logic"),
  sym("forall", "For all", "∀", "Logic"),
  sym("exists", "There exists", "∃", "Logic"),
  sym("not", "Not / negation", "¬", "Logic"),
  sym("and", "Logical AND", "∧", "Logic"),
  sym("or", "Logical OR", "∨", "Logic"),

  // Advanced / calculus
  sym("infinity", "Infinity", "∞", "Advanced", ["inf"]),
  sym("partial", "Partial derivative", "∂", "Advanced"),
  sym("nabla", "Nabla / gradient", "∇", "Advanced"),
  sym("factorial", "Factorial", "!", "Advanced"),
  sym("increment", "Increment / change", "Δ", "Advanced", ["delta"]),

  // Arrows
  sym("rightarrow", "Right arrow", "→", "Arrows"),
  sym("leftarrow", "Left arrow", "←", "Arrows"),
  sym("mapsto", "Maps to", "↦", "Arrows"),
];

// Greek letters — lower + upper.
const GREEK_PAIRS: Array<[string, string, string]> = [
  ["alpha", "α", "Α"], ["beta", "β", "Β"], ["gamma", "γ", "Γ"],
  ["delta", "δ", "Δ"], ["epsilon", "ε", "Ε"], ["zeta", "ζ", "Ζ"],
  ["eta", "η", "Η"], ["theta", "θ", "Θ"], ["iota", "ι", "Ι"],
  ["kappa", "κ", "Κ"], ["lambda", "λ", "Λ"], ["mu", "μ", "Μ"],
  ["nu", "ν", "Ν"], ["xi", "ξ", "Ξ"], ["pi", "π", "Π"],
  ["rho", "ρ", "Ρ"], ["sigma", "σ", "Σ"], ["tau", "τ", "Τ"],
  ["upsilon", "υ", "Υ"], ["phi", "φ", "Φ"], ["chi", "χ", "Χ"],
  ["psi", "ψ", "Ψ"], ["omega", "ω", "Ω"],
];
for (const [name, lower, upper] of GREEK_PAIRS) {
  SYMBOLS.push(sym(name, name.charAt(0).toUpperCase() + name.slice(1), lower, "Greek", ["greek"]));
  SYMBOLS.push(sym(name + "Upper", name.charAt(0).toUpperCase() + name.slice(1) + " (capital)", upper, "Greek", ["greek", "capital"]));
}
