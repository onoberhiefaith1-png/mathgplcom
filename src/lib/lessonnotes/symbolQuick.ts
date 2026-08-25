// Symbols quick-access data — the eleven categories teachers reach for while
// writing a lesson note, in a FIXED priority order (frequency of use, not
// mathematical hierarchy).
//
// This module is pure data. Every item is either
//   • a plain character run inserted as text, or
//   • a real editable structure (the same `mathStructure` objects the Asset
//     Library and the Matrix palette insert) with an optional literal prefix.
//
// Matrix is deliberately ABSENT: it owns its own quick-access palette.

export interface QuickTextItem {
  kind: "text";
  label: string;
  value: string;
  title?: string;
}

export interface QuickStructItem {
  kind: "struct";
  label: string;
  /** Structure kind understood by structureValidator / insertAsset. */
  structure: string;
  attrs?: Record<string, unknown>;
  /** Plain characters typed before the structure (e.g. "sin ", "y = "). */
  prefix?: string;
  title?: string;
}

export type QuickSymbolItem = QuickTextItem | QuickStructItem;

export interface QuickSymbolCategory {
  id: string;
  name: string;
  items: QuickSymbolItem[];
}

const t = (label: string, value?: string, title?: string): QuickTextItem =>
  ({ kind: "text", label, value: value ?? label, ...(title ? { title } : {}) });

const s = (
  label: string,
  structure: string,
  opts: { attrs?: Record<string, unknown>; prefix?: string; title?: string } = {},
): QuickStructItem => ({ kind: "struct", label, structure, ...opts });

/** Fixed display order — highest priority first. Do not re-sort. */
export const SYMBOL_CATEGORIES: QuickSymbolCategory[] = [
  {
    id: "core",
    name: "Core",
    items: [
      t("+"), t("−"), t("±"), t("×"), t("÷"), t("·", "·", "Multiply dot"),
      t("="), t("≠"), t("<"), t(">"), t("≤"), t("≥"),
      t("≈"), t("∞"), t("%"), t("°"), t("π"),
      s("√", "sqrt", { title: "Square root" }),
      s("∛", "cuberoot", { title: "Cube root" }),
      s("( )", "paren", { title: "Parentheses" }),
      s("[ ]", "sqbracket", { title: "Square brackets" }),
      s("{ }", "brace", { title: "Curly braces" }),
      s("|x|", "abs", { title: "Absolute value" }),
      t("→"), t("←"), t("↔"), t("⇒"), t("⇔"),
    ],
  },
  {
    id: "greek",
    name: "Greek letters",
    items: [
      t("α"), t("β"), t("θ"), t("γ"), t("δ"),
      t("π"), t("λ"), t("μ"), t("σ"),
      t("φ"), t("ω"), t("Δ"), t("Σ"), t("Ω"),
    ],
  },
  {
    id: "algebra",
    name: "Algebra",
    items: [
      t("x"), t("y"), t("z"), t("a"), t("b"), t("c"), t("n"), t("k"),
      t("x²"), t("x³"), t("xⁿ"), t("x⁻¹"),
      s("√x", "sqrt", { title: "Square root of an expression" }),
      s("∛x", "cuberoot", { title: "Cube root of an expression" }),
      t("f(x)"), t("f⁻¹(x)"),
      t("x =", "x = "), t("y =", "y = "), t("f(x) =", "f(x) = "),
    ],
  },
  {
    id: "number",
    name: "Number & fraction",
    items: [
      t("½"), t("⅓"), t("¼"), t("⅔"), t("¾"), t("%"),
      s("□/□", "fraction", { title: "Fraction — type numerator, then denominator" }),
      s("a/b", "slanted", { title: "Slanted fraction" }),
      s("√", "sqrt", { title: "Square root" }),
      s("∛", "cuberoot", { title: "Cube root" }),
    ],
  },
  {
    id: "trig",
    name: "Plane trigonometry",
    items: [
      t("sin θ", "sin θ"), t("cos θ", "cos θ"), t("tan θ", "tan θ"),
      t("sin⁻¹"), t("cos⁻¹"), t("tan⁻¹"),
      t("θ"), t("α"), t("β"), t("°"),
      t("SOH"), t("CAH"), t("TOA"),
      t("sin θ =", "sin θ = "), t("cos θ =", "cos θ = "), t("tan θ =", "tan θ = "),
    ],
  },
  {
    id: "geometry",
    name: "Geometry",
    items: [
      t("∠"), t("⊥"), t("∥"), t("△"), t("°"), t("90°"), t("≅"), t("∼"),
      t("AB"), t("BC"), t("CD"), t("AC"),
      t("x"), t("y"), t("r"), t("d"),
    ],
  },
  {
    id: "coord",
    name: "Coordinate geometry",
    items: [
      t("(x, y)"), t("(x₁, y₁)"), t("(x₂, y₂)"),
      t("Δx"), t("Δy"), t("m"), t("c"),
      t("x-axis"), t("y-axis"),
      t("y = mx + c", "y = mx + c"), t("y = ax + b", "y = ax + b"),
    ],
  },
  {
    id: "stats",
    name: "Statistics & probability",
    items: [
      t("x̄"), t("μ"), t("σ"), t("σ²"), t("n"),
      s("Σ", "bigop", { attrs: { op: "∑" }, title: "Summation with limits" }),
      t("P(A)"), t("P(A∩B)"), t("P(A∪B)"), t("P(A|B)"),
      t("E(X)"), t("Var(X)"), t("SD"),
      t("P(A) =", "P(A) = "), t("P(A|B) =", "P(A|B) = "),
      t("E(X) =", "E(X) = "), t("Var(X) =", "Var(X) = "),
    ],
  },
  {
    id: "calculus",
    name: "Calculus",
    items: [
      t("dy/dx"), t("d²y/dx²"),
      s("d/dx", "deriv", { title: "Derivative structure" }),
      s("∫", "bigop", { attrs: { op: "∫" }, title: "Integral" }),
      s("∫ₐᵇ", "bigop", { attrs: { op: "∫" }, title: "Definite integral — type the limits" }),
      s("lim", "limit", { title: "Limit" }),
      t("Δ"), t("∂"), t("Σ"), t("∞"),
      t("lim x→a", "lim x→a "),
      t("dy/dx =", "dy/dx = "),
      t("∫ f(x) dx", "∫ f(x) dx"),
      t("∫ₐᵇ f(x) dx", "∫ₐᵇ f(x) dx"),
      s("∂/∂x", "partial", { title: "Partial derivative" }),
    ],
  },
  {
    id: "sets",
    name: "Sets",
    items: [
      t("∈"), t("∉"), t("⊂"), t("⊆"), t("⊃"), t("⊇"),
      t("∪"), t("∩"), t("∅"),
      t("ℕ"), t("ℤ"), t("ℚ"), t("ℝ"),
    ],
  },
  {
    id: "logs",
    name: "Logarithms & exponentials",
    items: [
      t("log"), t("ln"), t("logₐ"),
      t("eˣ"), t("aˣ"), t("10ˣ"),
      s("logₐ(x)", "log", { title: "Logarithm — base then argument" }),
      s("ln(x)", "ln", { title: "Natural logarithm" }),
      s("eˣ", "power", { prefix: "e", title: "e to a power" }),
      s("aˣ", "power", { prefix: "a", title: "a to a power" }),
    ],
  },
];

/** Case-insensitive filter that never changes the category order. */
export function filterSymbolCategories(query: string): QuickSymbolCategory[] {
  const q = query.trim().toLowerCase();
  if (!q) return SYMBOL_CATEGORIES;
  const out: QuickSymbolCategory[] = [];
  for (const c of SYMBOL_CATEGORIES) {
    const items = c.items.filter((i) => {
      const hay = [i.label, i.title ?? "", c.name,
        i.kind === "text" ? i.value : i.structure].join(" ").toLowerCase();
      return hay.includes(q);
    });
    if (items.length) out.push({ ...c, items });
  }
  return out;
}
