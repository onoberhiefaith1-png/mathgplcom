import { useMemo, useState, type MouseEvent } from "react";
import { Waves, X, ChartNoAxesCombined, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { slopeFn, exactSolution, euler, rk4, rk4Steps, equilibria, systemFn, rk4System, ODE_MODELS } from "@/lib/graphApp/ode";
import { fmt } from "@/lib/graphApp/linalg";

type Mode = "single" | "system";
export default function OdePanel({ onPlot, onClose }: { onPlot: (src: string) => void; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("single");
  const [src, setSrc] = useState("dy/dx = -0.5y + 1");
  const [fSrc, setFSrc] = useState("y"), [gSrc, setGSrc] = useState("-x - 0.2y");
  const [x0, setX0] = useState(0), [y0, setY0] = useState(0), [h, setH] = useState(0.5), [n, setN] = useState(6), [T, setT] = useState(20);
  const [R, setR] = useState(5);
  const [history, setHistory] = useState<[number, number][]>([]);
  const [modelId, setModelId] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, number>>({});
  const model = ODE_MODELS.find(m => m.id === modelId) ?? null;

  const applyModel = (id: string, p?: Record<string, number>) => {
    const m = ODE_MODELS.find(q => q.id === id)!;
    const vals = p ?? Object.fromEntries(m.params.map(q => [q.key, q.value]));
    const b = m.build(vals);
    setModelId(id); setParams(vals); setR(b.window); setHistory([]);
    if (m.system) { setMode("system"); setFSrc(b.f); setGSrc(b.g!); } else { setMode("single"); setSrc(`dy/dx = ${b.f}`); }
    if (!p) { setX0(b.x0); setY0(b.y0); }
  };

  const single = useMemo(() => {
    if (mode !== "single") return null;
    try {
      const f = slopeFn(src);
      const exact = exactSolution(f, x0, y0);
      const rows = euler(f, x0, y0, h, n), rkRows = rk4Steps(f, x0, y0, h, n);
      const curveAt = (a: number, b: number) => [...rk4(f, a, b, -R).reverse(), ...rk4(f, a, b, R).slice(1)];
      const arrows: number[][] = [];
      for (let i = -R; i <= R; i += R / 5) for (let j = -R; j <= R; j += R / 5) { const s = f(i, j); if (Number.isFinite(s)) { const l = 0.35 * R / 5 / Math.hypot(1, s); arrows.push([i - l, j - l * s, i + l, j + l * s]); } }
      return { exact, rows, rkRows, curve: curveAt(x0, y0), past: history.map(([a, b]) => curveAt(a, b)), arrows, eq: equilibria(f, -4 * R, 4 * R), error: null as string | null };
    } catch (e) { return { error: e instanceof Error ? e.message : "Cannot read equation" }; }
  }, [mode, src, x0, y0, h, n, R, history]);

  const sys = useMemo(() => {
    if (mode !== "system") return null;
    try {
      const F = systemFn(fSrc, gSrc);
      const arrows: number[][] = [];
      for (let i = -R; i <= R; i += R / 6) for (let j = -R; j <= R; j += R / 6) { const [a, b] = F(i, j); const m = Math.hypot(a, b); if (Number.isFinite(m) && m > 1e-9) { const l = 0.3 * R / 6 / m; arrows.push([i - l * a, j - l * b, i + l * a, j + l * b]); } }
      return { path: rk4System(F, x0, y0, T), past: history.map(([a, b]) => rk4System(F, a, b, T)), arrows, error: null as string | null };
    } catch (e) { return { error: e instanceof Error ? e.message : "Cannot read system" }; }
  }, [mode, fSrc, gSrc, x0, y0, T, R, history]);

  const px = (x: number) => 20 + (x + R) / (2 * R) * 240, py = (y: number) => 260 - (Math.max(-2 * R, Math.min(2 * R, y)) + R) / (2 * R) * 240;
  const tap = (e: MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const sx = (e.clientX - r.left) / r.width * 280, sy = (e.clientY - r.top) / r.height * 280;
    const x = Math.round(((sx - 20) / 240 * 2 * R - R) * 100) / 100, y = Math.round(((260 - sy) / 240 * 2 * R - R) * 100) / 100;
    if (Math.abs(x) > R || Math.abs(y) > R) return;
    setHistory(hs => [...hs.slice(-7), [x0, y0]]); setX0(x); setY0(y);
  };
  const field = "h-9 w-full rounded-md border bg-background px-2 font-mono text-sm";
  const num = (v: number, set: (n: number) => void, label: string, step = "any") => <label className="text-xs">{label}<input aria-label={label} type="number" step={step} value={Number.isFinite(v) ? v : ""} className={field} onChange={e => set(Number(e.target.value))} /></label>;
  const poly = (pts: number[][], cls: { stroke: string; w: number; o?: number; dash?: string }, key?: number) => <polyline key={key} points={pts.map(p => `${px(p[0])},${py(p[1])}`).join(" ")} fill="none" stroke={cls.stroke} strokeWidth={cls.w} strokeOpacity={cls.o ?? 1} strokeDasharray={cls.dash} />;
  const axes = <><line x1="20" x2="260" y1={py(0)} y2={py(0)} stroke="hsl(var(--muted-foreground))" /><line x1={px(0)} x2={px(0)} y1="20" y2="260" stroke="hsl(var(--muted-foreground))" /></>;
  const out = single ?? sys;

  return <section aria-label="Differential equations" className="absolute inset-y-0 right-0 z-30 flex w-[min(460px,100%)] flex-col gap-3 overflow-y-auto border-l bg-card p-4 shadow-lg">
    <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><Waves className="h-4 w-4" />Differential equations</h2><Button variant="ghost" size="icon-sm" aria-label="Close tools" onClick={onClose}><X /></Button></div>
    <div className="flex gap-2">{(["single", "system"] as Mode[]).map(m => <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => { setMode(m); setModelId(null); setHistory([]); }}>{m === "single" ? "Single equation" : "System"}</Button>)}</div>
    <div className="flex flex-wrap gap-1.5" aria-label="Classic models">{ODE_MODELS.map(m => <Button key={m.id} size="sm" variant={modelId === m.id ? "secondary" : "ghost"} className="h-7 border text-xs" onClick={() => applyModel(m.id)}>{m.name}</Button>)}</div>
    {model && <div className="rounded-md border bg-muted p-3 text-xs"><p className="mb-2">{model.meaning}</p>
      <div className="grid grid-cols-2 gap-2">{model.params.map(p => <label key={p.key}>{p.label} = {fmt(params[p.key])}<input aria-label={p.label} type="range" min={p.min} max={p.max} step={(p.max - p.min) / 100} value={params[p.key]} className="w-full" onChange={e => applyModel(model.id, { ...params, [p.key]: Math.round(Number(e.target.value) * 100) / 100 })} /></label>)}</div></div>}
    {mode === "single"
      ? <label className="text-sm">dy/dx = f(x, y)<input aria-label="Differential equation" value={src} onChange={e => { setSrc(e.target.value); setModelId(null); }} className={field} /></label>
      : <div className="grid grid-cols-2 gap-2"><label className="text-sm">dx/dt =<input aria-label="dx/dt" value={fSrc} onChange={e => { setFSrc(e.target.value); setModelId(null); }} className={field} /></label><label className="text-sm">dy/dt =<input aria-label="dy/dt" value={gSrc} onChange={e => { setGSrc(e.target.value); setModelId(null); }} className={field} /></label></div>}
    <div className="grid grid-cols-4 gap-2">{num(x0, setX0, mode === "single" ? "x₀" : "x(0)")}{num(y0, setY0, mode === "single" ? "y₀" : "y(0)")}{mode === "single" ? <>{num(h, setH, "Step h")}{num(n, v => setN(Math.round(v)), "Steps", "1")}</> : <>{num(T, setT, "Time T")}{num(R, v => setR(Math.max(1, v)), "Window")}</>}</div>
    {out?.error ? <p role="alert" className="text-sm text-destructive">{out.error}</p> : <>
      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Tap the field to start a new solution there.</span>{history.length > 0 && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setHistory([])}><Eraser />Clear</Button>}</div>
      <svg viewBox="0 0 280 280" role="img" aria-label={mode === "single" ? "Slope field and solution curves" : "Phase plane"} className="w-full cursor-crosshair rounded-md border bg-background" onClick={tap}>
        {axes}
        {(single?.arrows ?? sys?.arrows ?? []).map(([a, b, c, d], i) => <line key={i} x1={px(a)} y1={py(b)} x2={px(c)} y2={py(d)} stroke="hsl(var(--muted-foreground))" strokeWidth="1.2" />)}
        {single?.eq?.filter(e => Math.abs(e.y) <= R).map(e => <g key={e.y}><line x1="20" x2="260" y1={py(e.y)} y2={py(e.y)} stroke="hsl(var(--foreground))" strokeDasharray="5 3" /><text x="258" y={py(e.y) - 3} textAnchor="end" fontSize="9" fill="hsl(var(--foreground))">{e.stable === null ? "semi" : e.stable ? "stable" : "unstable"}</text></g>)}
        {single && <>{single.past!.map((c, i) => poly(c, { stroke: "hsl(var(--primary))", w: 1.5, o: 0.3 }, i))}{poly(single.curve!, { stroke: "hsl(var(--primary))", w: 2.5 })}{poly(single.rows!.map(r => [r.x, r.y]), { stroke: "hsl(var(--destructive))", w: 1.5, dash: "4 3" })}</>}
        {sys && <>{sys.past!.map((c, i) => poly(c.map(p => [p[1], p[2]]), { stroke: "hsl(var(--primary))", w: 1.5, o: 0.3 }, i))}{poly(sys.path!.map(p => [p[1], p[2]]), { stroke: "hsl(var(--primary))", w: 2.5 })}</>}
        <circle cx={px(x0)} cy={py(y0)} r="4" fill="hsl(var(--primary))" />
      </svg>
      {single && <>
        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Slope arrows</span><span className="text-primary">Accurate solution</span><span className="text-destructive">Euler steps</span></div>
        {single.eq && <div className="rounded-md border p-3 text-sm"><h3 className="mb-1 font-semibold">Equilibria (f(y) = 0)</h3>
          {single.eq.length ? <ul className="space-y-0.5 text-xs">{single.eq.map(e => <li key={e.y}>y = {fmt(e.y)}: {e.stable === null ? "semi-stable (test inconclusive)" : e.stable ? "stable — nearby solutions move towards it" : "unstable — nearby solutions move away"}</li>)}</ul> : <p className="text-xs text-muted-foreground">No equilibrium in view.</p>}</div>}
        <div className="rounded-md border bg-muted p-3 text-sm"><h3 className="mb-1 font-semibold">{single.exact ? "Exact solution" : "Numerical solution"}</h3>
          {single.exact ? <ol className="list-decimal space-y-1 pl-5 font-mono text-xs">{single.exact.steps.filter(Boolean).map((s, i) => <li key={i}>{s}</li>)}</ol>
            : <p className="text-xs text-muted-foreground">No exact method for this equation here. The blue curve is an accurate numerical (RK4) solution; the table compares Euler with RK4.</p>}
          {single.exact && <Button className="mt-2" variant="outline" size="sm" onClick={() => onPlot(single.exact!.equation)}><ChartNoAxesCombined />Plot on graph</Button>}
        </div>
        <div className="overflow-x-auto"><h3 className="mb-1 text-sm font-semibold">Euler yₙ₊₁ = yₙ + h·f vs Runge–Kutta (RK4)</h3>
          <table className="w-full font-mono text-xs"><thead><tr className="text-left"><th>n</th><th>xₙ</th><th>Euler</th><th>RK4</th>{single.exact ? <><th>exact</th><th>Euler err</th><th>RK4 err</th></> : <th>difference</th>}</tr></thead>
            <tbody>{single.rows!.map((r, i) => { const k = single.rkRows![i].y, ex = single.exact?.value(r.x); return <tr key={r.n} className="border-t"><td>{r.n}</td><td>{fmt(r.x)}</td><td>{fmt(r.y)}</td><td>{fmt(k)}</td>{ex !== undefined ? <><td>{fmt(ex)}</td><td>{Math.abs(r.y - ex).toExponential(1)}</td><td>{Math.abs(k - ex).toExponential(1)}</td></> : <td>{Math.abs(r.y - k).toExponential(1)}</td>}</tr>; })}</tbody></table>
          <p className="mt-1 text-xs text-muted-foreground">Halve h and Euler's error roughly halves; RK4's falls about 16 times.</p></div>
      </>}
      {sys && <div><h3 className="mb-1 text-sm font-semibold">x(t) and y(t) over time</h3>
        <svg viewBox="0 0 280 120" role="img" aria-label="x and y over time" className="w-full rounded-md border bg-background">{(() => {
          const P = sys.path!, M = Math.max(1e-9, ...P.map(p => Math.max(Math.abs(p[1]), Math.abs(p[2])))), tx = (t: number) => 10 + t / T * 260, ty = (v: number) => 60 - v / M * 50;
          return <><line x1="10" x2="270" y1="60" y2="60" stroke="hsl(var(--muted-foreground))" /><polyline points={P.map(p => `${tx(p[0])},${ty(p[1])}`).join(" ")} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" /><polyline points={P.map(p => `${tx(p[0])},${ty(p[2])}`).join(" ")} fill="none" stroke="hsl(var(--destructive))" strokeWidth="2" /></>;
        })()}</svg>
        <div className="flex justify-between text-xs"><span className="text-primary">x(t)</span><span className="text-muted-foreground">t from 0 to {fmt(T)}</span><span className="text-destructive">y(t)</span></div></div>}
    </>}
  </section>;
}
