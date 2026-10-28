import type { ParsedEquation } from "./math";

export interface PlotBounds { xmin: number; xmax: number; ymin: number; ymax: number }
export const clampScale = (scale: number) => Math.max(2, Math.min(5000, scale));
export function modeFor(eq: ParsedEquation): "2D" | "3D" {
  return eq.kind === "curve2d" || eq.kind === "point2d" || eq.kind === "implicit2d" || (eq.kind === "parametric" && eq.dimension === 2) ? "2D" : "3D";
}
export function boundsFor(eq: ParsedEquation): PlotBounds {
  const points: Array<[number, number]> = [];
  if (eq.kind === "point2d") points.push(eq.p);
  if (eq.kind === "parametric") {
    for (let t = -4 * Math.PI; t <= 4 * Math.PI; t += 0.08) points.push([eq.fx({ t }), eq.fy({ t })]);
  }
  if (eq.kind === "curve2d") {
    const f = (x: number) => eq.f({ x });
    const c = f(0), a = (f(1) + f(-1) - 2 * c) / 2, b = (f(1) - f(-1)) / 2;
    const quadratic = [2, -2, 3].every((x) => Math.abs(f(x) - (a * x * x + b * x + c)) < 1e-7);
    let lo = -5, hi = 5;
    if (quadratic && Math.abs(a) > 1e-10) {
      const vertex = -b / (2 * a), discriminant = b * b - 4 * a * c;
      const radius = discriminant >= 0 ? Math.sqrt(discriminant) / (2 * Math.abs(a)) : 2;
      lo = vertex - Math.max(2, radius * 1.35); hi = vertex + Math.max(2, radius * 1.35);
      points.push([vertex, f(vertex)]);
      if (discriminant >= 0) points.push([vertex - radius, 0], [vertex + radius, 0]);
    } else if (quadratic && Math.abs(b) > 1e-10) {
      const root = -c / b; lo = Math.min(-2, root - 2); hi = Math.max(2, root + 2);
    }
    for (let i = 0; i <= 100; i++) { const x = lo + (hi - lo) * i / 100; const y = f(x); if (Math.abs(y) < 1e5) points.push([x, y]); }
  }
  if (eq.kind === "implicit2d") {
    for (let x = -50; x <= 50; x += 0.5) for (let y = -50; y < 50; y += 0.5) {
      const a = eq.f({ x, y }), b = eq.f({ x, y: y + 0.5 });
      if (Number.isFinite(a) && Number.isFinite(b) && (a === 0 || a * b < 0)) points.push([x, y]);
    }
  }
  const finite = points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (!finite.length) return { xmin: -5, xmax: 5, ymin: -5, ymax: 5 };
  const xs = finite.map(([x]) => x), ys = finite.map(([, y]) => y);
  const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
  const px = Math.max(1, (xmax - xmin) * 0.12), py = Math.max(1, (ymax - ymin) * 0.12);
  return { xmin: xmin - px, xmax: xmax + px, ymin: ymin - py, ymax: ymax + py };
}
export function fitBounds(bounds: PlotBounds, width: number, height: number) {
  return { cx: (bounds.xmin + bounds.xmax) / 2, cy: (bounds.ymin + bounds.ymax) / 2,
    scale: clampScale(Math.min(Math.max(1, width - 48) / (bounds.xmax - bounds.xmin), Math.max(1, height - 48) / (bounds.ymax - bounds.ymin))) };
}
export function combinedBounds(equations: ParsedEquation[]): PlotBounds {
  const bounds = equations.filter((eq) => modeFor(eq) === "2D").map(boundsFor);
  if (!bounds.length) return { xmin: -5, xmax: 5, ymin: -5, ymax: 5 };
  return { xmin: Math.min(...bounds.map(b => b.xmin)), xmax: Math.max(...bounds.map(b => b.xmax)), ymin: Math.min(...bounds.map(b => b.ymin)), ymax: Math.max(...bounds.map(b => b.ymax)) };
}