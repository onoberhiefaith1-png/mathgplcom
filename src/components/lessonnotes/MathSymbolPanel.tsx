// Mathematics Symbol Panel — opens from the lesson-note ribbon.
// One trigger button, 18 always-visible categories. Each button either inserts
// a raw Unicode symbol or a `mathInline` node containing a LaTeX-ish structure
// with `\sl{}` "type-here" placeholder cells so fractions, roots, matrices etc.
// open as empty editable slots (□) instead of pre-filled letters.

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FunctionSquare } from "lucide-react";
import { cn } from "@/lib/utils";



type ItemKind = "text" | "math";
interface SymItem {
  label: string;
  title: string;
  kind: ItemKind;
  value: string;
}
interface Category {
  id: string;
  name: string;
  items: SymItem[];
  cols?: number;
}

const t = (label: string, value: string, title?: string): SymItem =>
  ({ label, title: title ?? label, kind: "text", value });
const m = (label: string, value: string, title?: string): SymItem =>
  ({ label, title: title ?? label, kind: "math", value });

const CATEGORIES: Category[] = [
  {
    id: "ops", name: "Basic operators", cols: 7,
    items: [
      t("·", "·", "Dot multiply"), t("−", "−", "Minus"), t("×", "×", "Multiply"),
      t("÷", "÷", "Divide"), t("=", "="), t("≠", "≠"), t("≈", "≈"),
      t("<", "<"), t("≤", "≤"), t("≥", "≥"), t(">", ">"),
      t("±", "±"), t("∓", "∓"), t("∞", "∞"),
    ],
  },
  {
    id: "frac", name: "Fractions", cols: 3,
    items: [
      m("□/□", "\\frac{\\sl{}}{\\sl{}}", "Fraction"),
      m("(x+1)/2", "\\frac{x+1}{2}", "Linear / number"),
      m("x/(x²+1)", "\\frac{x}{x^{2}+1}", "Algebraic fraction"),
    ],
  },
  {
    id: "pow", name: "Powers & indices", cols: 4,
    items: [
      m("x²", "x^{2}", "x squared"),
      m("x³", "x^{3}", "x cubed"),
      m("xⁿ", "x^{n}", "x to the n"),
      m("□^□", "\\sl{}^{\\sl{}}", "Custom power"),
    ],
  },
  {
    id: "sub", name: "Subscripts", cols: 4,
    items: [
      m("x₁", "x_{1}"), m("x₂", "x_{2}"), m("xₙ", "x_{n}"),
      m("□_□", "\\sl{}_{\\sl{}}", "Custom subscript"),
    ],
  },
  {
    id: "root", name: "Roots", cols: 3,
    items: [
      m("√", "\\sqrt{\\sl{}}", "Square root"),
      m("³√", "\\sqrt[3]{\\sl{}}", "Cube root"),
      m("ⁿ√", "\\sqrt[\\sl{}]{\\sl{}}", "nth root"),
    ],
  },
  {
    id: "brk", name: "Brackets", cols: 4,
    items: [
      m("( )", "(\\sl{})", "Parentheses"),
      m("[ ]", "[\\sl{}]", "Square brackets"),
      m("{ }", "\\{\\sl{}\\}", "Curly braces"),
      m("| |", "\\left|\\sl{}\\right|", "Absolute value"),
    ],
  },
  {
    id: "trig", name: "Trigonometry", cols: 3,
    items: [
      m("sin", "\\sin(\\sl{})"), m("cos", "\\cos(\\sl{})"), m("tan", "\\tan(\\sl{})"),
      m("cosec", "\\csc(\\sl{})"), m("sec", "\\sec(\\sl{})"), m("cot", "\\cot(\\sl{})"),
    ],
  },
  {
    id: "log", name: "Logarithms", cols: 3,
    items: [
      m("log", "\\log(\\sl{})"),
      m("log₂", "\\log_{2}(\\sl{})"),
      m("ln", "\\ln(\\sl{})"),
    ],
  },
  {
    id: "calc", name: "Calculus", cols: 3,
    items: [
      m("∫", "\\int \\sl{} \\,d\\sl{}", "Indefinite integral"),
      m("∫ᵃᵇ", "\\int_{\\sl{}}^{\\sl{}} \\sl{} \\,d\\sl{}", "Definite integral"),
      m("d/dx", "\\frac{d}{d\\sl{}}"),
      m("dy/dx", "\\frac{d\\sl{}}{d\\sl{}}"),
      m("∂/∂x", "\\frac{\\partial \\sl{}}{\\partial \\sl{}}"),
    ],
  },
  {
    id: "sum", name: "Summation & product", cols: 2,
    items: [
      m("Σ", "\\sum_{\\sl{}}^{\\sl{}} \\sl{}", "Summation"),
      m("Π", "\\prod_{\\sl{}}^{\\sl{}} \\sl{}", "Product"),
    ],
  },
  {
    id: "lim", name: "Limits", cols: 2,
    items: [
      m("lim", "\\lim_{\\sl{} \\to \\sl{}} \\sl{}", "Limit"),
      m("lim ∞", "\\lim_{\\sl{} \\to \\infty} \\sl{}", "Limit to infinity"),
    ],
  },
  {
    id: "mat", name: "Matrices", cols: 3,
    items: [
      m("2×2", "\\begin{pmatrix} \\sl{} & \\sl{} \\\\ \\sl{} & \\sl{} \\end{pmatrix}"),
      m("3×3", "\\begin{pmatrix} \\sl{} & \\sl{} & \\sl{} \\\\ \\sl{} & \\sl{} & \\sl{} \\\\ \\sl{} & \\sl{} & \\sl{} \\end{pmatrix}"),
      m("4×4", "\\begin{pmatrix} \\sl{} & \\sl{} & \\sl{} & \\sl{} \\\\ \\sl{} & \\sl{} & \\sl{} & \\sl{} \\\\ \\sl{} & \\sl{} & \\sl{} & \\sl{} \\\\ \\sl{} & \\sl{} & \\sl{} & \\sl{} \\end{pmatrix}"),
    ],
  },
  {
    id: "vec", name: "Vectors", cols: 2,
    items: [
      m("→AB", "\\overrightarrow{AB}"),
      m("→a", "\\vec{a}"),
    ],
  },
  {
    id: "set", name: "Sets", cols: 6,
    items: [
      t("∈", "∈"), t("∉", "∉"), t("⊂", "⊂"), t("⊆", "⊆"),
      t("∪", "∪"), t("∩", "∩"), t("∅", "∅"),
      t("ℕ", "ℕ"), t("ℤ", "ℤ"), t("ℚ", "ℚ"), t("ℝ", "ℝ"),
    ],
  },
  {
    id: "prob", name: "Probability", cols: 2,
    items: [
      t("P(A)", "P(A)"),
      t("P(A∩B)", "P(A∩B)"),
      t("P(A∪B)", "P(A∪B)"),
      t("n(A)", "n(A)"),
    ],
  },
  {
    id: "greek", name: "Greek letters", cols: 6,
    items: [
      t("α", "α"), t("β", "β"), t("γ", "γ"), t("δ", "δ"),
      t("θ", "θ"), t("λ", "λ"), t("μ", "μ"), t("π", "π"),
      t("σ", "σ"), t("ω", "ω"), t("Δ", "Δ"), t("Σ", "Σ"),
    ],
  },
  {
    id: "geo", name: "Geometry", cols: 7,
    items: [
      t("°", "°"), t("∠", "∠"), t("△", "△"),
      t("⊥", "⊥"), t("∥", "∥"), t("≅", "≅"), t("~", "~"),
    ],
  },
  {
    id: "arr", name: "Arrows", cols: 5,
    items: [
      t("→", "→"), t("←", "←"), t("↔", "↔"),
      t("⇒", "⇒"), t("⇔", "⇔"),
    ],
  },
];


interface Props {
  insertText: (s: string) => void;
  insertMath: (latex: string) => void;
}

export function MathSymbolPanel({ insertText, insertMath }: Props) {
  const onClick = (it: SymItem) => {
    if (it.kind === "text") insertText(it.value);
    else insertMath(it.value);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Insert mathematics symbol"
          className="p-1.5 rounded hover:bg-foreground/10 inline-flex items-center gap-1 text-xs"
        >
          <FunctionSquare className="h-4 w-4" /> Symbols
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-[420px] max-h-[70vh] overflow-y-auto p-3 text-popover-foreground"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-3">
          {CATEGORIES.map((cat) => (
            <section key={cat.id}>
              <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-popover-foreground/70">
                {cat.name}
              </h4>
              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: `repeat(${cat.cols ?? 4}, minmax(0, 1fr))` }}
              >
                {cat.items.map((it, idx) => (
                  <button
                    key={`${cat.id}-${idx}`}
                    type="button"
                    title={it.title}
                    onClick={() => onClick(it)}
                    className={cn(
                      "h-9 rounded border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
                      "text-sm font-medium leading-none px-1 truncate",
                    )}
                  >
                    {it.label}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

