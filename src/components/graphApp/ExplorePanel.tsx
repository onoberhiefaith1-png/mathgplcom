import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { add, sub, mul, div, parseC, fmtC, modulus, argument, rootsOfUnity, complexFn, domainColour, type C } from "@/lib/graphApp/complex";
import { applyTransform, conic, type ConicKind, type P, type Transform } from "@/lib/graphApp/geometry";
import { binomialPmf, poissonPmf, normalBetween, moments } from "@/lib/graphApp/probability";
import { parsePoints, regression, summary } from "@/lib/graphApp/stats";
import { newton, bisection } from "@/lib/graphApp/numerical";
import { fmt } from "@/lib/graphApp/linalg";

export type ExploreTool = "complex" | "geometry" | "probability" | "stats" | "numerical";
export const EXPLORE_TOOLS: [ExploreTool, string][] = [["complex", "Complex"], ["geometry", "Geometry"], ["probability", "Probability"], ["stats", "Statistics"], ["numerical", "Numerical"]];

const field = "h-9 w-full rounded-md border bg-background px-2 font-mono text-sm";
const tab = (on: boolean) => `rounded-md border px-2 py-1 text-xs font-medium ${on ? "bg-primary text-primary-foreground" : ""}`;
const Err = ({ msg }: { msg: string }) => <p role="alert" className="rounded-md bg-destructive/10 px-2 py-1 text-sm text-destructive">{msg}</p>;
function attempt<T>(f: () => T): T | { error: string } { try { return f(); } catch (e) { return { error: e instanceof Error ? e.message : "Cannot read the input" }; } }
const isErr = (v: unknown): v is { error: string } => typeof v === "object" && v !== null && "error" in v;

/** Square SVG plane from -R..R with axes. */
function Plane({ R, children }: { R: number; children: React.ReactNode }) {
  return <svg viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`} className="aspect-square w-full rounded-md border bg-background" role="img" aria-label="Diagram">
    <g transform="scale(1,-1)" strokeWidth={R / 150}>
      <line x1={-R} x2={R} y1={0} y2={0} stroke="currentColor" opacity={0.3} />
      <line y1={-R} y2={R} x1={0} x2={0} stroke="currentColor" opacity={0.3} />
      {children}
    </g>
  </svg>;
}

function ComplexTool() {
  const [aS, setA] = useState("1 + 2i"), [bS, setB] = useState("i"), [op, setOp] = useState<"+" | "−" | "×" | "÷">("×");
  const [n, setN] = useState(5), [fS, setF] = useState("z^2");
  const res = useMemo(() => attempt(() => { const a = parseC(aS), b = parseC(bS); const r = op === "+" ? add(a, b) : op === "−" ? sub(a, b) : op === "×" ? mul(a, b) : div(a, b); return { a, b, r }; }), [aS, bS, op]);
  const roots = useMemo(() => attempt(() => rootsOfUnity(n)), [n]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const fErr = useMemo(() => attempt(() => { complexFn(fS); return true; }), [fS]);
  useEffect(() => {
    const c = canvas.current; if (!c || isErr(fErr)) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const S = 160, img = ctx.createImageData(S, S), f = complexFn(fS);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const z: C = { re: -2 + 4 * i / S, im: 2 - 4 * j / S }, w = f(z);
      const [r, g, b] = domainColour(w);
      // contour lines where |w| crosses an integer power of 2
      const m = Math.log2(modulus(w)), edge = Math.abs(m - Math.round(m)) < 0.04;
      const k = 4 * (j * S + i); img.data[k] = edge ? r * 0.5 : r; img.data[k + 1] = edge ? g * 0.5 : g; img.data[k + 2] = edge ? b * 0.5 : b; img.data[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [fS, fErr]);
  const R = isErr(res) ? 3 : Math.max(2, ...[res.a, res.b, res.r].map(modulus)) * 1.2;
  const vec = (z: C, col: string) => <line x1={0} y1={0} x2={z.re} y2={z.im} stroke={col} strokeWidth={R / 60} strokeLinecap="round" />;
  return <div className="space-y-3">
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
      <input className={field} value={aS} onChange={e => setA(e.target.value)} aria-label="First complex number" />
      <select className="h-9 rounded-md border bg-background px-1" value={op} onChange={e => setOp(e.target.value as typeof op)} aria-label="Operation">{["+", "−", "×", "÷"].map(o => <option key={o}>{o}</option>)}</select>
      <input className={field} value={bS} onChange={e => setB(e.target.value)} aria-label="Second complex number" />
    </div>
    {isErr(res) ? <Err msg={res.error} /> : <>
      <p className="font-mono text-sm">= <b>{fmtC(res.r)}</b></p>
      {op === "×" && <p className="text-xs text-muted-foreground">Multiplying by {fmtC(res.b)} scales by |b| = {fmt(modulus(res.b))} and turns by {fmt(argument(res.b) * 180 / Math.PI)}°.</p>}
      <Plane R={R}>{vec(res.a, "#2563eb")}{vec(res.b, "#16a34a")}{vec(res.r, "#dc2626")}</Plane>
      <p className="text-xs"><span className="text-[#2563eb]">■ a</span> <span className="text-[#16a34a]">■ b</span> <span className="text-[#dc2626]">■ result</span></p>
    </>}
    <h3 className="text-sm font-semibold">Roots of unity: zⁿ = 1, n = {n}</h3>
    <Slider min={1} max={12} step={1} value={[n]} onValueChange={v => setN(v[0])} aria-label="n" />
    {!isErr(roots) && <Plane R={1.4}><circle r={1} fill="none" stroke="currentColor" opacity={0.4} strokeWidth={0.01} />
      <polygon points={roots.map(z => `${z.re},${z.im}`).join(" ")} fill="none" stroke="#9333ea" strokeWidth={0.015} />
      {roots.map((z, k) => <circle key={k} cx={z.re} cy={z.im} r={0.05} fill="#9333ea" />)}</Plane>}
    <h3 className="text-sm font-semibold">Domain colouring of f(z), −2 ≤ Re, Im ≤ 2</h3>
    <input className={field} value={fS} onChange={e => setF(e.target.value)} aria-label="Complex function" />
    <div className="flex gap-1">{["z^2", "1/z", "e^z", "(z - 1)/(z + 1)", "z^3 - 1"].map(s => <button key={s} className={tab(fS === s)} onClick={() => setF(s)}>{s}</button>)}</div>
    {isErr(fErr) ? <Err msg={fErr.error} /> : <canvas ref={canvas} width={160} height={160} className="aspect-square w-full rounded-md border [image-rendering:pixelated]" aria-label="Domain colouring" />}
    <p className="text-xs text-muted-foreground">Colour shows the direction of f(z); dark rings mark where |f(z)| doubles. Zeros are where every colour meets.</p>
  </div>;
}

function GeometryTool({ onPreview }: { onPreview: (s: string[]) => void }) {
  const [mode, setMode] = useState<"transform" | "conic">("transform");
  const [kind, setKind] = useState<Transform["kind"]>("rotate");
  const [deg, setDeg] = useState(90), [k, setK] = useState(2), [dx, setDx] = useState(3), [dy, setDy] = useState(1), [line, setLine] = useState<"x-axis" | "y-axis" | "y=x" | "y=-x">("y=x");
  const [ck, setCk] = useState<ConicKind>("ellipse"), [a, setA] = useState(4), [b, setB] = useState(2);
  const shape: P[] = [[1, 1], [3, 1], [1, 2]];
  const t: Transform = kind === "rotate" ? { kind, deg, cx: 0, cy: 0 } : kind === "reflect" ? { kind, line } : kind === "enlarge" ? { kind, k, cx: 0, cy: 0 } : { kind, dx, dy };
  const image = applyTransform(shape, t);
  const c = useMemo(() => attempt(() => conic(ck, a, b)), [ck, a, b]);
  useEffect(() => { onPreview(mode === "conic" && !isErr(c) ? c.plot : []); }, [mode, c, onPreview]);
  const num = (v: number, set: (n: number) => void, label: string) => <label className="text-xs">{label}<input type="number" className={field} value={v} onChange={e => set(Number(e.target.value))} /></label>;
  return <div className="space-y-3">
    <div className="flex gap-1"><button className={tab(mode === "transform")} onClick={() => setMode("transform")}>Transformations</button><button className={tab(mode === "conic")} onClick={() => setMode("conic")}>Conics</button></div>
    {mode === "transform" ? <>
      <div className="flex flex-wrap gap-1">{(["rotate", "reflect", "enlarge", "translate"] as const).map(x => <button key={x} className={tab(kind === x)} onClick={() => setKind(x)}>{x}</button>)}</div>
      <div className="grid grid-cols-2 gap-2">
        {kind === "rotate" && num(deg, setDeg, "Angle (°) about origin")}
        {kind === "enlarge" && num(k, setK, "Scale factor about origin")}
        {kind === "translate" && <>{num(dx, setDx, "Move right")}{num(dy, setDy, "Move up")}</>}
        {kind === "reflect" && <select className={field} value={line} onChange={e => setLine(e.target.value as typeof line)} aria-label="Mirror line">{["x-axis", "y-axis", "y=x", "y=-x"].map(l => <option key={l}>{l}</option>)}</select>}
      </div>
      <Plane R={Math.max(5, ...image.flat().map(Math.abs)) + 1}>
        {kind === "reflect" && <line x1={-20} x2={20} y1={line === "x-axis" ? 0 : line === "y=x" ? -20 : line === "y=-x" ? 20 : -20} y2={line === "x-axis" ? 0 : line === "y=x" ? 20 : line === "y=-x" ? -20 : 20} transform={line === "y-axis" ? "rotate(90)" : undefined} stroke="#ea580c" strokeDasharray="0.3 0.2" strokeWidth={0.05} />}
        <polygon points={shape.map(p => p.join(",")).join(" ")} fill="#2563eb33" stroke="#2563eb" strokeWidth={0.06} />
        <polygon points={image.map(p => p.join(",")).join(" ")} fill="#dc262633" stroke="#dc2626" strokeWidth={0.06} />
      </Plane>
      <table className="w-full font-mono text-xs"><tbody>{shape.map((p, i) => <tr key={i}><td>({p.join(", ")})</td><td>→</td><td>({image[i].map(fmt).join(", ")})</td></tr>)}</tbody></table>
    </> : <>
      <div className="flex flex-wrap gap-1">{(["circle", "ellipse", "parabola", "hyperbola"] as const).map(x => <button key={x} className={tab(ck === x)} onClick={() => setCk(x)}>{x}</button>)}</div>
      <div className="grid grid-cols-2 gap-2">{num(a, setA, ck === "parabola" ? "Focal distance a" : ck === "circle" ? "Radius" : "a")}{(ck === "ellipse" || ck === "hyperbola") && num(b, setB, "b")}</div>
      {isErr(c) ? <Err msg={c.error} /> : <div className="space-y-1 text-sm">
        <p className="font-mono font-semibold">{c.equation}</p>
        <p>{c.definition}</p>
        <p className="text-xs text-muted-foreground">Focus: {c.foci.map(f => `(${f.map(fmt).join(", ")})`).join(" and ")}{c.directrix ? ` · directrix ${c.directrix}` : ""}. Drawn on the graph.</p>
      </div>}
    </>}
  </div>;
}

function ProbabilityTool({ onPreview }: { onPreview: (s: string[]) => void }) {
  const [dist, setDist] = useState<"normal" | "binomial" | "poisson">("normal");
  const [mu, setMu] = useState(0), [sd, setSd] = useState(1), [lo, setLo] = useState(-1), [hi, setHi] = useState(1);
  const [n, setN] = useState(10), [p, setP] = useState(0.5), [lam, setLam] = useState(3);
  const prob = useMemo(() => attempt(() => normalBetween(lo, hi, mu, sd)), [lo, hi, mu, sd]);
  useEffect(() => {
    if (dist !== "normal") { onPreview([]); return; }
    const pdf = `exp(-((x - (${mu}))^2) / (2 * ${sd}^2)) / (${sd} * sqrt(2 * pi))`;
    onPreview([`y = ${pdf}`, `y = (x >= ${Math.min(lo, hi)} and x <= ${Math.max(lo, hi)}) ? ${pdf} : 0`]);
  }, [dist, mu, sd, lo, hi, onPreview]);
  const bars = useMemo(() => attempt(() => dist === "binomial" ? Array.from({ length: n + 1 }, (_, k) => binomialPmf(n, p, k)) : dist === "poisson" ? Array.from({ length: Math.ceil(lam * 3 + 6) }, (_, k) => poissonPmf(lam, k)) : []), [dist, n, p, lam]);
  const s = (label: string, v: number, set: (x: number) => void, min: number, max: number, step: number) =>
    <label className="block text-xs">{label} = <b>{v}</b><Slider min={min} max={max} step={step} value={[v]} onValueChange={x => set(x[0])} aria-label={label} /></label>;
  return <div className="space-y-3">
    <div className="flex gap-1">{(["normal", "binomial", "poisson"] as const).map(d => <button key={d} className={tab(dist === d)} onClick={() => setDist(d)}>{d}</button>)}</div>
    {dist === "normal" ? <>
      {s("μ", mu, setMu, -5, 5, 0.1)}{s("σ", sd, setSd, 0.2, 4, 0.1)}{s("a", lo, setLo, -8, 8, 0.1)}{s("b", hi, setHi, -8, 8, 0.1)}
      {isErr(prob) ? <Err msg={prob.error} /> : <p className="text-sm">P({fmt(Math.min(lo, hi))} &lt; X &lt; {fmt(Math.max(lo, hi))}) = <b>{prob.toFixed(4)}</b></p>}
      <p className="text-xs text-muted-foreground">The bell curve and the shaded probability are drawn on the graph and move with the sliders.</p>
    </> : <>
      {dist === "binomial" ? <>{s("n", n, setN, 1, 40, 1)}{s("p", p, setP, 0, 1, 0.01)}</> : s("λ", lam, setLam, 0.5, 15, 0.5)}
      {!isErr(bars) && <svg viewBox="0 0 300 160" className="w-full rounded-md border bg-background" role="img" aria-label="Distribution bars">
        {bars.map((v, k) => { const w = 280 / bars.length, h = 140 * v / Math.max(...bars); return <g key={k}><rect x={10 + k * w} y={150 - h} width={w * 0.8} height={h} fill="#2563eb" /><title>P(X = {k}) = {v.toFixed(4)}</title></g>; })}
      </svg>}
      {(() => { const m = dist === "binomial" ? moments("binomial", n, p) : moments("poisson", lam); return <p className="text-sm">Mean = <b>{fmt(m.mean)}</b>, variance = <b>{fmt(m.variance)}</b></p>; })()}
    </>}
  </div>;
}

function StatsTool({ onPreview }: { onPreview: (s: string[]) => void }) {
  const [src, setSrc] = useState("1, 2.1\n2, 3.9\n3, 6.2\n4, 7.8\n5, 10.1");
  const out = useMemo(() => attempt(() => { const pts = parsePoints(src); return { pts, reg: regression(pts), sx: summary(pts.map(p => p[0])), sy: summary(pts.map(p => p[1])) }; }), [src]);
  useEffect(() => { onPreview(isErr(out) ? [] : [`y = ${out.reg.slope} x + (${out.reg.intercept})`, ...out.pts.slice(0, 0).map(String)]); }, [out, onPreview]);
  return <div className="space-y-3">
    <label className="text-xs">Data points (x, y), one per line or pasted columns
      <textarea className="h-32 w-full rounded-md border bg-background p-2 font-mono text-sm" value={src} onChange={e => setSrc(e.target.value)} /></label>
    {isErr(out) ? <Err msg={out.error} /> : <>
      <p className="font-mono text-sm font-semibold">y = {fmt(out.reg.slope)}x {out.reg.intercept < 0 ? "−" : "+"} {fmt(Math.abs(out.reg.intercept))}</p>
      <p className="text-sm">r = <b>{out.reg.r.toFixed(4)}</b>, R² = <b>{out.reg.r2.toFixed(4)}</b> — {Math.abs(out.reg.r) > 0.9 ? "strong" : Math.abs(out.reg.r) > 0.5 ? "moderate" : "weak"} {out.reg.r >= 0 ? "positive" : "negative"} correlation.</p>
      <table className="w-full text-xs"><thead><tr><th></th><th>n</th><th>mean</th><th>median</th><th>sd</th></tr></thead><tbody>
        {([["x", out.sx], ["y", out.sy]] as const).map(([k, s]) => <tr key={k} className="text-center font-mono"><td>{k}</td><td>{s.n}</td><td>{fmt(s.mean)}</td><td>{fmt(s.median)}</td><td>{fmt(s.sd)}</td></tr>)}
      </tbody></table>
      <svg viewBox="0 0 300 200" className="w-full rounded-md border bg-background" role="img" aria-label="Scatter plot">
        {(() => { const xs = out.pts.map(p => p[0]), ys = out.pts.map(p => p[1]); const x0 = Math.min(...xs), x1 = Math.max(...xs) || x0 + 1, y0 = Math.min(...ys), y1 = Math.max(...ys);
          const X = (x: number) => 15 + 270 * (x - x0) / ((x1 - x0) || 1), Y = (y: number) => 185 - 170 * (y - y0) / ((y1 - y0) || 1);
          return <><line x1={X(x0)} y1={Y(out.reg.intercept + out.reg.slope * x0)} x2={X(x1)} y2={Y(out.reg.intercept + out.reg.slope * x1)} stroke="#dc2626" strokeWidth={2} />
            {out.pts.map((p, i) => <circle key={i} cx={X(p[0])} cy={Y(p[1])} r={4} fill="#2563eb" />)}</>; })()}
      </svg>
      <p className="text-xs text-muted-foreground">The regression line is also drawn on the graph.</p>
    </>}
  </div>;
}

function NumericalTool({ onPreview }: { onPreview: (s: string[]) => void }) {
  const [method, setMethod] = useState<"newton" | "bisection">("newton");
  const [f, setF] = useState("y = x^3 - 2x - 5"), [x0, setX0] = useState(2), [a, setA] = useState(2), [b, setB] = useState(3), [shown, setShown] = useState(1);
  const out = useMemo(() => attempt(() => method === "newton" ? newton(f, x0) : bisection(f, a, b)), [method, f, x0, a, b]);
  useEffect(() => { setShown(1); }, [method, f, x0, a, b]);
  useEffect(() => {
    if (isErr(out)) { onPreview([]); return; }
    const extra = method === "newton"
      ? out.steps.slice(0, shown).map(s => "dfx" in s ? `y = (${s.dfx}) * (x - (${s.x})) + (${s.fx})` : "").filter(Boolean).slice(-1)
      : out.steps.slice(0, shown).slice(-1).flatMap(s => "m" in s ? [`x = ${s.a} + 0y`, `x = ${s.b} + 0y`] : []);
    onPreview([f, ...extra]);
  }, [out, shown, f, method, onPreview]);
  const steps = isErr(out) ? [] : out.steps.slice(0, shown);
  return <div className="space-y-3">
    <div className="flex gap-1"><button className={tab(method === "newton")} onClick={() => setMethod("newton")}>Newton–Raphson</button><button className={tab(method === "bisection")} onClick={() => setMethod("bisection")}>Bisection</button></div>
    <input className={field} value={f} onChange={e => setF(e.target.value)} aria-label="Function" />
    <div className="grid grid-cols-2 gap-2">
      {method === "newton" ? <label className="text-xs">Start x₀<input type="number" className={field} value={x0} onChange={e => setX0(Number(e.target.value))} /></label>
        : <><label className="text-xs">a<input type="number" className={field} value={a} onChange={e => setA(Number(e.target.value))} /></label><label className="text-xs">b<input type="number" className={field} value={b} onChange={e => setB(Number(e.target.value))} /></label></>}
    </div>
    {isErr(out) ? <Err msg={out.error} /> : <>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setShown(s => Math.min(out.steps.length, s + 1))} disabled={shown >= out.steps.length}>Next step</Button>
        <Button size="sm" variant="outline" onClick={() => setShown(out.steps.length)}>All steps</Button>
        <Button size="sm" variant="ghost" onClick={() => setShown(1)}>Restart</Button>
      </div>
      {out.steps.length === 0 ? <Err msg={out.message} /> : <table className="w-full font-mono text-xs"><thead><tr>{method === "newton" ? ["n", "xₙ", "f(xₙ)", "f′(xₙ)", "xₙ₊₁"].map(h => <th key={h}>{h}</th>) : ["n", "a", "b", "m", "f(m)"].map(h => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{steps.map(s => <tr key={s.n} className="text-center">{"dfx" in s ? [s.n, s.x, s.fx, s.dfx, s.next].map((v, i) => <td key={i}>{i ? v.toPrecision(10) : v}</td>) : [s.n, s.a, s.b, s.m, s.fm].map((v, i) => <td key={i}>{i ? v.toPrecision(8) : v}</td>)}</tr>)}</tbody></table>}
      {shown >= out.steps.length && <p className={`text-sm ${out.root === null ? "text-destructive" : ""}`}>{out.message}{out.root !== null && <> Root ≈ <b>{out.root.toPrecision(12)}</b></>}</p>}
      <p className="text-xs text-muted-foreground">{method === "newton" ? "The latest tangent is drawn on the graph; where it meets the x-axis is the next guess." : "The current interval [a, b] is drawn on the graph; it halves at every step."}</p>
    </>}
  </div>;
}

export default function ExplorePanel({ tool, onPreview, onClose }: { tool: ExploreTool; onPreview: (srcs: string[]) => void; onClose: () => void }) {
  useEffect(() => () => onPreview([]), [onPreview]);
  useEffect(() => { onPreview([]); }, [tool, onPreview]);
  const title = EXPLORE_TOOLS.find(t => t[0] === tool)?.[1];
  return <section aria-label={title} className="absolute inset-y-0 right-0 z-30 flex w-[min(460px,100%)] flex-col gap-3 overflow-y-auto border-l bg-card p-4 shadow-lg">
    <div className="flex items-center justify-between">
      <h2 className="font-semibold">{title}</h2>
      <Button variant="ghost" size="icon-sm" aria-label="Close tools" onClick={onClose}><X /></Button>
    </div>
    {tool === "complex" && <ComplexTool />}
    {tool === "geometry" && <GeometryTool onPreview={onPreview} />}
    {tool === "probability" && <ProbabilityTool onPreview={onPreview} />}
    {tool === "stats" && <StatsTool onPreview={onPreview} />}
    {tool === "numerical" && <NumericalTool onPreview={onPreview} />}
  </section>;
}
