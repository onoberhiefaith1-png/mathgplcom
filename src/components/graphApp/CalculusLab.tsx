// Math Lab Phase 4 — interactive calculus workspace (inside Math Lab only).
import { useEffect, useMemo, useState } from "react";
import { ChartNoAxesCombined } from "lucide-react";
import { Button } from "@/components/ui/button";
import { integrate, tangent } from "@/lib/graphApp/operations";
import { antiderivative, areaBetween, areaEquation, curveSource, derivativeSteps, formatNumber as f, keyPoints, limitAt, riemann, riemannEquation, withParameter, type RiemannMethod } from "@/lib/graphApp/calculus";
import type { LabSnapshot } from "@/lib/graphApp/savedGraphs";

type Tab = "derivative" | "integral" | "analysis";
export default function CalculusLab({ calculus, setCalculus, onPlot, onPreview }: {
  calculus: LabSnapshot["calculus"]; setCalculus: (v: LabSnapshot["calculus"]) => void;
  onPlot: (src: string) => void; onPreview: (srcs: string[]) => void;
}) {
  const [tab, setTab] = useState<Tab>("derivative");
  const [a, setA] = useState(1);
  const [other, setOther] = useState("");
  const [n, setN] = useState(6);
  const [method, setMethod] = useState<RiemannMethod>("midpoint");
  const [limitX, setLimitX] = useState(1);
  const [steps, setSteps] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const usesA = /\ba\b/.test(calculus.src);
  const curve = withParameter(curveSource(calculus.src), a);

  // Live overlays: curve + tangent (derivative tab) or strips / shaded region (integral tab).
  const preview = useMemo(() => {
    const out: string[] = [curve];
    try {
      if (tab === "derivative" && Number.isFinite(calculus.x)) out.push(tangent(curve, calculus.x).equation);
      if (tab === "integral") {
        out.push(areaEquation(curve, calculus.lower, calculus.upper, other.trim() ? curveSource(other) : undefined));
        if (!other.trim() && method !== "trapezium") out.push(riemannEquation(curve, calculus.lower, calculus.upper, n, method));
      }
      if (tab === "analysis") for (const p of keyPoints(curve)) out.push(`(${f(p.x)}, ${f(p.y)})`);
    } catch { /* message shown on demand */ }
    return out;
  }, [curve, tab, calculus.x, calculus.lower, calculus.upper, other, n, method]);
  useEffect(() => { onPreview(preview); }, [preview, onPreview]);
  useEffect(() => () => onPreview([]), [onPreview]);

  const run = (fn: () => string[]) => { try { setSteps(fn()); setError(null); } catch (e) { setSteps(null); setError(e instanceof Error ? e.message : "Unable to calculate this."); } };
  const field = "h-9 min-w-0 w-full rounded-md border bg-background px-2 font-mono text-sm";
  const num = (v: number) => (Number.isFinite(v) ? v : "");
  const setNum = (k: "x" | "lower" | "upper") => (e: React.ChangeEvent<HTMLInputElement>) => setCalculus({ ...calculus, [k]: e.target.value === "" ? NaN : Number(e.target.value) });

  let gradient: string | null = null;
  try { if (Number.isFinite(calculus.x)) { const t = tangent(curve, calculus.x); gradient = `At x = ${f(calculus.x)}: f(x) = ${f(t.value)}, gradient f′(x) = ${f(t.slope)}`; } } catch (e) { gradient = e instanceof Error ? e.message : null; }

  return <div className="flex flex-col gap-3">
    <label className="space-y-1 text-sm">Curve <span className="text-muted-foreground">(use <code>a</code> for a parameter)</span>
      <input aria-label="Calculus curve" className={field} value={calculus.src} onChange={(e) => { setCalculus({ ...calculus, src: e.target.value }); setSteps(null); }} />
    </label>
    {usesA && <label className="space-y-1 text-sm">a = {f(a)}<input aria-label="Parameter a" type="range" min={-5} max={5} step={0.1} value={a} onChange={(e) => setA(Number(e.target.value))} className="w-full" /></label>}

    <div role="tablist" className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1 text-sm">
      {(["derivative", "integral", "analysis"] as Tab[]).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setSteps(null); setError(null); }} className={tab === t ? "rounded bg-background px-2 py-1 font-medium shadow-sm" : "px-2 py-1 text-muted-foreground"}>{t === "derivative" ? "Derivative" : t === "integral" ? "Integral" : "Analysis"}</button>)}
    </div>

    {tab === "derivative" && <>
      <label className="space-y-1 text-sm">Point x = {num(calculus.x)}
        <input aria-label="Gradient explorer" type="range" min={-10} max={10} step={0.05} value={Number.isFinite(calculus.x) ? calculus.x : 0} onChange={setNum("x")} className="w-full" />
      </label>
      {gradient && <p className="rounded-md bg-muted p-2 font-mono text-sm">{gradient}</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => run(() => derivativeSteps(curve).steps)}>Show working</Button>
        <Button variant="outline" onClick={() => run(() => { const d = derivativeSteps(curve).first; onPlot(`y = ${d}`); return [`Plotted f′(x) = ${d}`]; })}><ChartNoAxesCombined />Plot f′</Button>
        <Button variant="outline" onClick={() => run(() => { const t = tangent(curve, calculus.x); onPlot(t.equation); return [`Tangent at x = ${f(calculus.x)}: y = ${f(t.slope)}(x − ${f(calculus.x)}) + ${f(t.value)}`]; })}>Keep tangent</Button>
      </div>
    </>}

    {tab === "integral" && <>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-sm">From<input aria-label="lower bound" type="number" step="any" className={field} value={num(calculus.lower)} onChange={setNum("lower")} /></label>
        <label className="space-y-1 text-sm">To<input aria-label="upper bound" type="number" step="any" className={field} value={num(calculus.upper)} onChange={setNum("upper")} /></label>
      </div>
      <label className="space-y-1 text-sm">Second curve (optional, for area between)<input aria-label="Second curve" placeholder="e.g. y = x" className={field} value={other} onChange={(e) => setOther(e.target.value)} /></label>
      {!other.trim() && <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-sm">Strips: {n}<input aria-label="Strips" type="range" min={1} max={50} value={n} onChange={(e) => setN(Number(e.target.value))} className="w-full" /></label>
        <label className="space-y-1 text-sm">Method<select aria-label="Riemann method" className={field} value={method} onChange={(e) => setMethod(e.target.value as RiemannMethod)}><option value="left">Left</option><option value="right">Right</option><option value="midpoint">Midpoint</option><option value="trapezium">Trapezium</option></select></label>
      </div>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => run(() => { const r = antiderivative(curve); return r ? r.steps : ["No exact antiderivative is available for this curve here; use the definite integral (numerical)."]; })}>Indefinite ∫</Button>
        <Button variant="outline" onClick={() => run(() => {
          const lo = calculus.lower, hi = calculus.upper;
          if (other.trim()) { const v = areaBetween(curve, curveSource(other), lo, hi); return [`Area between the curves on [${f(lo)}, ${f(hi)}]`, `= ∫ |f(x) − g(x)| dx`, `≈ ${f(v)} (numerical, Simpson's rule)`]; }
          const exact = antiderivative(curve), r = integrate(curve, lo, hi), s = riemann(curve, lo, hi, n, method);
          const lines = [`∫ from ${f(lo)} to ${f(hi)} of f(x) dx`];
          if (exact) lines.push(`F(x) = ${exact.result.replace(" + C", "")}`, `= F(${f(hi)}) − F(${f(lo)})`, `= ${f(r.value)} (exact for polynomials)`);
          else lines.push(`≈ ${f(r.value)} (numerical, error ≈ ${r.error.toExponential(1)})`);
          lines.push(`${method[0].toUpperCase() + method.slice(1)} sum with ${n} strips ≈ ${f(s)} (approximation, difference ${f(Math.abs(s - r.value))})`);
          return lines;
        })}>Definite ∫</Button>
      </div>
    </>}

    {tab === "analysis" && <>
      <Button variant="outline" onClick={() => run(() => {
        const pts = keyPoints(curve), d = derivativeSteps(curve);
        if (!pts.length) return [`f′(x) = ${d.first}`, "No stationary or inflection points between x = −10 and 10."];
        return [`f′(x) = ${d.first}`, `f″(x) = ${d.second}`, "Solve f′(x) = 0 for stationary points; f″ changes sign at inflections:", ...pts.map((p) => `(${f(p.x)}, ${f(p.y)}) — ${p.kind}`)];
      })}>Stationary & inflection points</Button>
      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <label className="space-y-1 text-sm">Limit as x →<input aria-label="Limit point" type="number" step="any" className={field} value={limitX} onChange={(e) => setLimitX(Number(e.target.value))} /></label>
        <Button variant="outline" onClick={() => run(() => { const l = limitAt(curve, limitX); return [`From the left ≈ ${f(l.left)}`, `From the right ≈ ${f(l.right)}`, l.text]; })}>Limit & continuity</Button>
      </div>
    </>}

    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {steps && <output aria-label="Calculation result" className="space-y-1 rounded-md border bg-muted p-3 font-mono text-sm">{steps.map((s, i) => <div key={i}>{s}</div>)}</output>}
    <p className="text-xs text-muted-foreground">Exact results come from algebra; anything marked ≈ is a numerical approximation.</p>
  </div>;
}
