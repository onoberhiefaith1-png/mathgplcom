import { useState } from "react";
import { Calculator, ChartNoAxesCombined, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { matrixOperation, transformedSquare, squareEquation, type Matrix, type MatrixOperation } from "@/lib/graphApp/operations";
import { eigen, multiplySteps, solveSystem, PRESETS, fmt } from "@/lib/graphApp/linalg";
import CalculusLab from "./CalculusLab";
import type { LabSnapshot } from "@/lib/graphApp/savedGraphs";
const numberText = (n: number) => Number(n.toPrecision(9)).toString();
export default function LabToolsPanel({ tab, matrices, setMatrices, calculus, setCalculus, onPlot, onPreview, onClose }: {
  tab: "matrices" | "calculus";
  matrices: LabSnapshot["matrices"]; setMatrices: (value: LabSnapshot["matrices"]) => void;
  calculus: LabSnapshot["calculus"]; setCalculus: (value: LabSnapshot["calculus"]) => void;
  onPlot: (src: string) => void; onPreview?: (srcs: string[]) => void; onClose: () => void;
}) {
  const [result, setResult] = useState<number | Matrix | string | null>(null);
  const [rhs, setRhs] = useState<number[]>([1, 1, 1]);
  const [error, setError] = useState<string | null>(null);
  const run = (action: () => number | Matrix | string) => { try { setResult(action()); setError(null); } catch (e) { setResult(null); setError(e instanceof Error ? e.message : "Unable to calculate."); } };
  let square: [number, number][] = [];
  try { square = transformedSquare(matrices.a); } catch { /* incomplete matrix */ }
  const coords = [...square, [0, 0], [1, 1]];
  const low = Math.min(-0.5, ...coords.flat()), high = Math.max(1.5, ...coords.flat()), span = high - low;
  const poly = (points: number[][]) => points.map(([x, y]) => `${20 + (Math.max(low - span, Math.min(high + span, x)) - low) / span * 200},${220 - (Math.max(low - span, Math.min(high + span, y)) - low) / span * 200}`).join(" ");
  const a2 = matrices.a.length === 2 && square.length ? matrices.a : null;
  const tf = (x: number, y: number) => a2 ? [a2[0][0] * x + a2[0][1] * y, a2[1][0] * x + a2[1][1] * y] : [x, y];
  const gridLines = a2 ? [-2, -1, 0, 1, 2, 3].flatMap(k => [[tf(k, -2), tf(k, 3)], [tf(-2, k), tf(3, k)]]) : [];
  let eigLines: number[][] = []; try { if (a2) eigLines = eigen(a2).real.map(e => e.vector); } catch { /* none */ }
  let detText = ""; try { detText = fmt(Number(matrixOperation(matrices.a, matrices.b, "det"))); } catch { /* incomplete */ }
  const field = "h-9 min-w-0 w-full rounded-md border bg-background px-2 font-mono text-sm";
  return <section aria-label={tab === "matrices" ? "Matrix tools" : "Calculus tools"} className="absolute inset-y-0 right-0 z-30 flex w-[min(420px,100%)] flex-col gap-4 overflow-y-auto border-l bg-card p-4 shadow-lg">
    <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><Calculator className="h-4 w-4" />{tab === "matrices" ? "Matrices" : "Calculus"}</h2><Button variant="ghost" size="icon-sm" aria-label="Close tools" onClick={onClose}><X /></Button></div>
    {tab === "matrices" ? <>
      <label className="flex items-center justify-between text-sm">Dimensions<select aria-label="Matrix dimensions" value={matrices.a.length} className="rounded-md border bg-background p-2" onChange={e => { const n = Number(e.target.value); setMatrices({ a: Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => matrices.a[i]?.[j] ?? Number(i === j))), b: Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => matrices.b[i]?.[j] ?? Number(i === j))) }); setResult(null); setError(null); }}><option value={2}>2 × 2</option><option value={3}>3 × 3</option></select></label>
      {(["a", "b"] as const).map(name => <fieldset key={name}><legend className="mb-2 text-sm font-semibold">Matrix {name.toUpperCase()}</legend><div className={matrices[name].length === 2 ? "grid grid-cols-2 gap-2" : "grid grid-cols-3 gap-2"}>{matrices[name].map((row, i) => row.map((value, j) => <input key={`${i}-${j}`} aria-label={`${name.toUpperCase()} row ${i + 1} column ${j + 1}`} type="number" step="any" value={Number.isFinite(value) ? value : ""} className={field} onChange={e => { setMatrices({ ...matrices, [name]: matrices[name].map((r, ri) => r.map((v, ci) => ri === i && ci === j ? e.target.value === "" ? NaN : Number(e.target.value) : v)) }); setResult(null); setError(null); }} />))}</div></fieldset>)}
      {matrices.a.length === 2 && <div className="flex flex-wrap gap-1">{PRESETS.map(p => <Button key={p.label} variant="secondary" size="sm" onClick={() => { setMatrices({ ...matrices, a: p.m }); setResult(null); setError(null); }}>{p.label}</Button>)}</div>}
      <div className="flex flex-wrap gap-2">{([["det", "det(A)"], ["inverse", "A⁻¹"], ["transpose", "Aᵀ"], ["add", "A + B"]] as [MatrixOperation, string][]).map(([op, label]) => <Button key={op} variant="outline" size="sm" aria-label={op === "inverse" ? "Inverse A" : label} onClick={() => run(() => matrixOperation(matrices.a, matrices.b, op))}>{label}</Button>)}
        <Button variant="outline" size="sm" aria-label="A × B" onClick={() => run(() => { const r = multiplySteps(matrices.a, matrices.b); return `${r.result.map(row => `[ ${row.map(fmt).join("   ")} ]`).join("\n")}\n\nEach entry = row of A · column of B\n${r.steps.join("\n")}`; })}>A × B</Button>
        <Button size="sm" onClick={() => run(() => { const r = eigen(matrices.a); return `${r.steps.join("\n")}\n\n${r.real.length ? r.real.map(e => `λ = ${fmt(e.value)}   v = (${e.vector.map(fmt).join(", ")})`).join("\n") + "\nThese directions do not turn: A v = λ v." : ""}`.trim(); })}>Eigenvalues & eigenvectors</Button></div>
      <fieldset><legend className="mb-2 text-sm font-semibold">Solve A x = b</legend><div className="flex gap-2">{rhs.slice(0, matrices.a.length).map((v, i) => <input key={i} aria-label={`b row ${i + 1}`} type="number" step="any" value={Number.isFinite(v) ? v : ""} className={field} onChange={e => setRhs(rhs.map((x, k) => k === i ? (e.target.value === "" ? NaN : Number(e.target.value)) : x))} />)}<Button variant="outline" size="sm" onClick={() => run(() => solveSystem(matrices.a, rhs.slice(0, matrices.a.length)).map((x, i) => `${"xyz"[i]} = ${fmt(x)}`).join("\n"))}>Solve</Button></div></fieldset>
      {matrices.a.length === 2 && <><svg viewBox="0 0 240 240" role="img" aria-label="Original and transformed unit square" className="w-full rounded-md border bg-background">{gridLines.map((g, i) => <polyline key={i} points={poly(g)} fill="none" stroke="hsl(var(--primary))" strokeOpacity="0.25" />)}<line x1="20" x2="220" y1={220 - (0 - low) / span * 200} y2={220 - (0 - low) / span * 200} stroke="hsl(var(--muted-foreground))" /><line x1={20 + (0 - low) / span * 200} x2={20 + (0 - low) / span * 200} y1="20" y2="220" stroke="hsl(var(--muted-foreground))" /><polygon points={poly([[0, 0], [1, 0], [1, 1], [0, 1]])} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="2" strokeDasharray="4 3" /><polygon points={poly(square)} fill="hsl(var(--accent))" fillOpacity="0.35" stroke="hsl(var(--primary))" strokeWidth="2" />{eigLines.map((v, i) => <polyline key={`e${i}`} points={poly([[-v[0] * 9, -v[1] * 9], [v[0] * 9, v[1] * 9]])} fill="none" stroke="hsl(var(--destructive))" strokeWidth="1.5" strokeDasharray="6 3" />)}</svg><div className="flex flex-wrap justify-between gap-1 text-xs"><span className="text-muted-foreground">Original · dashed</span><span className="text-primary">Transformed · solid + grid</span>{eigLines.length > 0 && <span className="text-destructive">Eigenvector lines stay put</span>}</div><p className="text-xs text-muted-foreground">det(A) = {detText}: areas are multiplied by {detText === "0" ? "0 — space is squashed flat" : `|${detText}|`}.</p><Button variant="outline" onClick={() => run(() => { const src = squareEquation(matrices.a); onPlot(src); return `Area factor: ${numberText(Math.abs(Number(matrixOperation(matrices.a, matrices.b, "det"))))}`; })}><ChartNoAxesCombined />Plot transformed square</Button></>}
    </> : <CalculusLab calculus={calculus} setCalculus={setCalculus} onPlot={onPlot} onPreview={onPreview ?? (() => {})} />}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {result !== null && <output aria-label="Calculation result" className="overflow-x-auto rounded-md border bg-muted p-3 font-mono text-sm whitespace-pre-wrap">{Array.isArray(result) ? result.map(row => `[ ${row.map(numberText).join("   ")} ]`).join("\n") : typeof result === "number" ? numberText(result) : result}</output>}
  </section>;
}
