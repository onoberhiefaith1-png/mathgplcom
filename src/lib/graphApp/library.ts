export type LibraryTab = "2D" | "3D" | "Parametric" | "ND" | "Matrices";
export interface LibraryEntry { tab: LibraryTab; label: string; expr: string }

export const LIBRARY: LibraryEntry[] = [
  ...["y = x^2", "y = 2x + 1", "y = x^3 - 3x", "y = 1/x", "y = 2^x", "y = sqrt(x)", "y = abs(x)",
    "y = sin(x)", "y = cos(x)", "y = tan(x)", "y = ln(x)", "y = e^(-x^2)"]
    .map((e) => ({ tab: "2D" as const, label: e, expr: e })),
  ...["z = x^2 + y^2", "z = sin(x) cos(y)", "z = 0.5x + 0.3y + 1", "x^2 + y^2 + z^2 = 9",
    "z = sqrt(x^2 + y^2)", "z = e^(-(x^2 + y^2))", "z = sin(sqrt(x^2 + y^2))", "z = x^2 - y^2", "(2, 1, 5)"]
    .map((e) => ({ tab: "3D" as const, label: e, expr: e })),
  ...["x = cos(t); y = sin(t); z = t / 4", "x = 2cos(t); y = 2sin(t); z = 0",
    "x = cos(3t); y = sin(2t); z = sin(t)", "x = t cos(t) / 4; y = t sin(t) / 4; z = t / 6"]
    .map((e) => ({ tab: "Parametric" as const, label: e.replace(/; /g, ",  "), expr: e })),
  ...[4, 5, 6].map((n) => ({ tab: "ND" as const, label: `${n}D hypercube`, expr: `ncube:${n}` })),
];
