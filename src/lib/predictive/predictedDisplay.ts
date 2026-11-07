import { friendlyToLatex } from "@/lib/notebook/mathFriendly";

/**
 * The predictive engine works on board ASCII — `(2)^(5)`, `(a)/(b)`,
 * `sqrt(x)` — which the inline math renderer shows as raw text. The predicted
 * line must be DISPLAYED with the same structure as the expected line, so it
 * is converted to the renderer's template form first (`2^{5}`, `\frac{a}{b}`,
 * `\sqrt{x}`). Matching and marking still use the ASCII; only the display
 * changes.
 */
export const predictedLineDisplay = (ascii: string | null | undefined): string => {
  const raw = String(ascii ?? "").trim();
  if (!raw) return "";
  // Board flattener writes roots as sqrt(…) / root(n,…).
  let s = raw
    .replace(/\broot\(\s*([^(),]+)\s*,/g, "ⁿ√[$1](")
    .replace(/\bsqrt\(/g, "√(");
  s = s.replace(/ⁿ√\[([^\]]+)\]\(([^()]*)\)/g, (_m, n: string, body: string) => `\\sqrt[${n}]{${body}}`);
  // Twice: inner ^(…) groups resolve first, then the √(…) around them.
  s = friendlyToLatex(friendlyToLatex(s));
  // A single-token base needs no grouping brackets: (2)^{5} → 2^{5}.
  s = s.replace(/\(([A-Za-z0-9.]+)\)(?=\^)/g, "$1");
  return s;
};
