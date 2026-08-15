// School-mathematics function templates for the Graph tool. Choosing one only
// pre-fills the expression field — the teacher can still edit or type any
// supported expression manually.

export interface GraphTemplate {
  id: string;
  label: string;
  /** Right-hand side of y = … */
  expression: string;
  hint?: string;
}

export const GRAPH_TEMPLATES: GraphTemplate[] = [
  { id: "linear", label: "Linear", expression: "2x + 3", hint: "y = mx + c" },
  { id: "quadratic", label: "Quadratic", expression: "x^2 - 4", hint: "y = ax² + bx + c" },
  { id: "cubic", label: "Cubic", expression: "x^3 - 3x", hint: "y = ax³ + bx + c" },
  { id: "reciprocal", label: "Reciprocal", expression: "1/x", hint: "y = k/x" },
  { id: "exponential", label: "Exponential", expression: "2^x", hint: "y = aˣ" },
  { id: "sqrt", label: "Square root", expression: "sqrt(x)", hint: "y = √x" },
  { id: "modulus", label: "Modulus", expression: "abs(x)", hint: "y = |x|" },
  { id: "sine", label: "Sine", expression: "sin(x)", hint: "y = sin x" },
  { id: "cosine", label: "Cosine", expression: "cos(x)", hint: "y = cos x" },
  { id: "tangent", label: "Tangent", expression: "tan(x)", hint: "y = tan x" },
  { id: "log", label: "Logarithm", expression: "log(x)", hint: "y = log₁₀ x" },
];

export const FUNCTION_COLOURS = [
  "hsl(220 90% 50%)",
  "hsl(0 78% 52%)",
  "hsl(150 70% 36%)",
  "hsl(280 70% 52%)",
  "hsl(30 90% 48%)",
  "hsl(190 85% 40%)",
];

export const nextFunctionColour = (count: number) =>
  FUNCTION_COLOURS[count % FUNCTION_COLOURS.length];
