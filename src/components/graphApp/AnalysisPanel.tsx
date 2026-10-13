import { useMemo, useState } from "react";
import { Activity, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  sequenceFn, sequenceTerms, convergesTo, seriesReport, epsilonN,
  fnOfX, numericalLimit, epsilonDelta, continuityAt,
  taylorCoeffs, taylorExpression, classicNote, COUNTER_EXAMPLES, type SeqFn, type Fn1,
} from "@/lib/graphApp/analysis";
import { fmt } from "@/lib/graphApp/linalg";

type Tab = "sequence" | "series" | "band" | "delta" | "taylor";

const field = "h-9 w-full rounded-md border bg-background px-2 font-mono text-sm";
const chips = ["1/2^n", "(-1)^n/n", "(-1)^n", "1/n", "n/(n + 1)"];
const TABS: [Tab, string][] = [["sequence", "Sequences"], ["series", "Series"], ["band", "ε–N band"], ["delta", "ε–δ"], ["taylor", "Taylor"]];

function useOutcome<T>(make: () => T, deps: unknown[]): T | { error: string } {
  return useMemo(() => { try { return make(); } catch (e) { return { error: e instanceof Error ? e.message : "Cannot read the input" }; } }, deps);
}

/** Scatter/table plot in an n or x axis, auto-scaled with clamping. */
function Plot({ pts, bands, shade }: { pts: { x: number; y: number; inside: boolean }[]; bands?: { y: number }[]; shade?: { lo: number; hi: number } | null }) {
  const ys = pts.map(p => p.y).filter(Number.isFinite).concat(bands?.map(b => b.y) ?? []);
  if (!ys.length) return null;
  const span = Math.max(...ys) - Math.min(...ys) || 1;
  const pad = span * 0.15;
  const lo = Math.min(...ys) - pad, hi = Math.max(...ys) + pad;
  const px = (x: number) => 24 + ((x - 0) / (Math.max(1, pts[pts.length - 1]?.x ?? 1))) * 232;
  const py = (y: number) => 260 - ((Math.min(hi, Math.max(lo, y)) - lo) / (hi - lo)) * 240;
  return <svg viewBox="0 0 280 280" role="img" aria-label="Plot" className="w-full rounded-md border bg-background">
    <line x1="20" x2="260" y1={py(0)} y2={py(0)} stroke="hsl(var(--muted-foreground))" />
    <line x1="24" x2="24" y1="20" y2="260" stroke="hsl(var(--muted-foreground))" />
    {shade && <rect x={px(shade.lo)} width={Math.max(1, px(shade.hi) - px(shade.lo))} y="20" height="240" fill="hsl(var(--primary))" opacity="0.12" />}
    {bands?.map((b, i) => <line key={i} x1="20" x2="260" y1={py(b.y)} y2={py(b.y)} stroke="hsl(var(--primary))" strokeDasharray="4 3" />)}
    {pts.map((p, i) => <circle key={i} cx={px(p.x)} cy={py(p.y)} r="3" fill={p.inside ? "hsl(var(--primary))" : "hsl(var(--destructive))"} />)}
  </svg>;
}

export default function AnalysisPanel({ onPlot, onPreview, onClose }: { onPlot: (src: string) => void; onPreview: (srcs: string[]) => void; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("sequence");
  const [seqSrc, setSeqSrc] = useState("1/2^n");
  const [count, setCount] = useState(30);
  const [bandEps, setBandEps] = useState(0.1);
  const [bandL, setBandL] = useState("");
  const [fSrc, setFSrc] = useState("2x + 1");
  const [a, setA] = useState(1);
  const [dEps, setDEps] = useState(0.1);
  const [tSrc, setTSrc] = useState("sin(x)");
  const [x0, setX0] = useState(0);
  const [deg, setDeg] = useState(5);

  const seq = useOutcome(() => {
    const f: SeqFn = sequenceFn(seqSrc);
    return { f, terms: sequenceTerms(f, count), verdict: convergesTo(sequenceTerms(f, Math.max(count, 40))) };
  }, [seqSrc, count]);
  const series = useOutcome(() => "f" in seq ? seriesReport(seq.f, count) : null, [seq, count]);
  const band = useOutcome(() => {
    if (!("f" in seq)) return null;
    const terms = seq.terms;
    const auto = convergesTo(terms);
    const L = bandL.trim() ? Number(bandL) : auto.kind === "convergent" ? auto.limit : Number.NaN;
    if (!Number.isFinite(L)) return null;
    const r = epsilonN(terms, L, bandEps);
    return { L, ...r };
  }, [seq, bandL, bandEps]);
  const delta = useOutcome(() => {
    const f: Fn1 = fnOfX(fSrc);
    const lim = numericalLimit(f, a);
    const ed = epsilonDelta(f, a, dEps);
    return { f, lim, ed, cont: continuityAt(f, a) };
  }, [fSrc, a, dEps]);
  const taylor = useOutcome(() => {
    const f: Fn1 = fnOfX(tSrc);
    const coeffs = taylorCoeffs(f, x0, deg);
    return { coeffs, expr: taylorExpression(coeffs, x0), note: classicNote(coeffs, x0) };
  }, [tSrc, x0, deg]);

  const seqBody = seqSrc.includes("=") ? seqSrc.slice(seqSrc.indexOf("=") + 1) : seqSrc;
  const Ls = band && !("error" in band) && Number.isFinite(band.L) ? `${fmt(band.L)} + ${fmt(bandEps)}|${fmt(band.L)} - ${fmt(bandEps)}` : null;

  return <section aria-label="Analysis" className="absolute inset-y-0 right-0 z-30 flex w-[min(460px,100%)] flex-col gap-3 overflow-y-auto border-l bg-card p-4 shadow-lg">
    <div className="flex items-center justify-between">
      <h2 className="flex items-center gap-2 font-semibold"><Activity className="h-4 w-4" />Analysis</h2>
      <Button variant="ghost" size="icon-sm" aria-label="Close tools" onClick={onClose}><X /></Button>
    </div>
    <div className="flex flex-wrap gap-1">
      {TABS.map(([id, label]) => (
        <button key={id} onClick={() => setTab(id)} className={`rounded-md border px-2 py-1 text-xs font-medium ${tab === id ? "bg-primary text-primary-foreground" : ""}`}>{label}</button>
      ))}
    </div>

    {(tab === "sequence" || tab === "series" || tab === "band") && <>
      <label className="text-sm">Formula for aₙ (use n)<input aria-label="Term formula" value={seqSrc} onChange={e => setSeqSrc(e.target.value)} className={field} /></label>
      <div className="flex flex-wrap gap-1">{chips.map(c => <button key={c} onClick={() => setSeqSrc(c)} className="rounded border px-2 py-0.5 font-mono text-xs">{c}</button>)}</div>
      <label className="flex items-center justify-between gap-2 text-sm">How many terms
        <input aria-label="Number of terms" type="number" min={1} max={500} value={count} onChange={e => setCount(Math.round(Number(e.target.value)))} className={`${field} w-24`} />
      </label>
      {seq instanceof Object && "error" in seq && <p role="alert" className="text-sm text-destructive">{seq.error}</p>}
    </>}

    {tab === "sequence" && seq instanceof Object && "terms" in seq && <>
      <p className="rounded-md border bg-muted p-3 text-sm">
        {seq.verdict.kind === "convergent" && <>The terms settle toward <strong>L ≈ {fmt(seq.verdict.limit)}</strong> (numerical evidence).</>}
        {seq.verdict.kind === "divergent" && <>{seq.verdict.reason}</>}
        {seq.verdict.kind === "oscillating" && <>{seq.verdict.reason}</>}
      </p>
      <Plot pts={seq.terms.map((t, i) => ({ x: i + 1, y: t, inside: true }))} />
      <p className="text-xs text-muted-foreground">Each dot is one term aₙ. A sequence that settles is convergent; one that grows or jumps forever is not.</p>
    </>}

    {tab === "series" && series instanceof Object && series !== null && "rows" in series && <>
      <p className="rounded-md border bg-muted p-3 text-sm">{series.verdict}</p>
      {series.exact && <p className="rounded-md border bg-muted p-3 text-sm font-mono">{series.exact}</p>}
      <Plot pts={series.rows.map(r => ({ x: r.n, y: r.sum, inside: true }))} />
      <div className="max-h-56 overflow-y-auto rounded-md border">
        <table className="w-full font-mono text-xs"><thead className="sticky top-0 bg-muted"><tr className="text-left"><th>n</th><th>aₙ</th><th>Sₙ</th></tr></thead>
          <tbody>{series.rows.slice(0, 40).map(r => <tr key={r.n} className="border-t"><td>{r.n}</td><td>{fmt(r.term)}</td><td>{fmt(r.sum)}</td></tr>)}</tbody></table>
      </div>
      <p className="text-xs text-muted-foreground">Sₙ is the running total of the first n terms. If Sₙ settles, the series converges to that value.</p>
    </>}

    {tab === "band" && seq instanceof Object && "terms" in seq && <>
      <p className="text-xs text-muted-foreground">Pick ε and see N: from N onward every term stays inside the band L ± ε.</p>
      <label className="text-sm">Limit L (blank = detected)<input aria-label="Limit L" value={bandL} onChange={e => setBandL(e.target.value)} placeholder="auto" className={field} /></label>
      <label className="flex items-center justify-between gap-2 text-sm">ε
        <input aria-label="Epsilon" type="number" step="any" min={1e-9} value={bandEps} onChange={e => setBandEps(Number(e.target.value))} className={`${field} w-28`} />
      </label>
      {band && !("error" in band) && Number.isFinite(band.L) ? <>
        <p className="rounded-md border bg-muted p-3 text-sm">
          {band.n !== null ? <>With ε = <strong>{fmt(bandEps)}</strong>, every term from <strong>N = {band.n}</strong> onward lies inside the band L ± ε, with L ≈ {fmt(band.L)}. That is the ε–N definition, seen not recited.</> : <>No N works within the {count} terms shown: the sequence does not stay inside this band yet. Show more terms or enlarge ε.</>}
        </p>
        <Plot pts={(seq as { terms: number[] }).terms.map((t, i) => ({ x: i + 1, y: t, inside: band.flags[i] }))}
          bands={[{ y: band.L + bandEps }, { y: band.L - bandEps }]} />
        {Ls && <Button variant="outline" size="sm" onClick={() => onPreview([`y = ${seqBody.replace(/\bn\b/g, "x")}`, Ls.split("|")[0], Ls.split("|")[1]])}><Eye />Show band on graph</Button>}
      </> : <p role="alert" className="text-sm text-destructive">This sequence has no detected limit. Type L by hand, or choose a settling formula.</p>}
    </>}

    {tab === "delta" && delta instanceof Object && "lim" in delta && <>
      <label className="text-sm">Function f(x)<input aria-label="Function" value={fSrc} onChange={e => setFSrc(e.target.value)} className={field} /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">Point a<input aria-label="Point a" type="number" step="any" value={a} onChange={e => setA(Number(e.target.value))} className={field} /></label>
        <label className="text-xs">ε<input aria-label="Delta epsilon" type="number" step="any" min={1e-9} value={dEps} onChange={e => setDEps(Number(e.target.value))} className={field} /></label>
      </div>
      <div className="flex flex-wrap gap-1">
        {COUNTER_EXAMPLES.map(c => <button key={c.id} onClick={() => { setFSrc(c.src); setA(c.a); setDEps(c.eps); }} className="rounded border px-2 py-0.5 text-xs">{c.label}</button>)}
      </div>
      <p className="rounded-md border bg-muted p-3 text-sm">
        <strong>{delta.cont.continuous ? "Continuous" : "Not continuous"}</strong> at x = {fmt(a)}. {delta.cont.reason}
      </p>
      <div className="rounded-md border bg-muted p-3 text-sm">
        <h3 className="mb-1 font-semibold">The ε–δ working</h3>
        <ol className="list-decimal space-y-1 pl-5 font-mono text-xs">{delta.ed.working.filter(Boolean).map((s, i) => <li key={i}>{s}</li>)}</ol>
      </div>
      <Plot pts={Array.from({ length: 60 }, (_, i) => { const x = a - 1.2 + (2.4 * i) / 59; return { x, y: delta.f(x), inside: Number.isFinite(delta.f(x)) && Math.abs(delta.f(x) - delta.ed.limit) < dEps }; })}
        bands={Number.isFinite(delta.ed.limit) ? [{ y: delta.ed.limit + dEps }, { y: delta.ed.limit - dEps }] : []}
        shade={delta.ed.delta ? { lo: a - delta.ed.delta, hi: a + delta.ed.delta } : null} />
      <p className="text-xs text-muted-foreground">Blue dots sit inside the band L ± ε; red dots break it. The shaded strip is the δ-interval that works.</p>
    </>}

    {tab === "taylor" && taylor instanceof Object && "coeffs" in taylor && <>
      <label className="text-sm">Function f(x)<input aria-label="Taylor function" value={tSrc} onChange={e => setTSrc(e.target.value)} className={field} /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">Centre x₀<input aria-label="Taylor centre" type="number" step="any" value={x0} onChange={e => setX0(Number(e.target.value))} className={field} /></label>
        <label className="text-xs flex flex-col justify-end">Degree
          <input aria-label="Taylor degree" type="number" min={0} max={6} value={deg} onChange={e => setDeg(Math.round(Number(e.target.value)))} className={field} />
        </label>
      </div>
      <p className="rounded-md border bg-muted p-3 font-mono text-xs break-all">{taylor.expr} <span className="text-muted-foreground">(≈ numerical)</span></p>
      {taylor.note && <p className="text-xs text-muted-foreground">{taylor.note}</p>}
      <div className="max-h-40 overflow-y-auto rounded-md border">
        <table className="w-full font-mono text-xs"><thead className="sticky top-0 bg-muted"><tr className="text-left"><th>k</th><th>f⁽ᵏ⁾(x₀)</th><th>coefficient</th></tr></thead>
          <tbody>{taylor.coeffs.map(t => <tr key={t.k} className="border-t"><td>{t.k}</td><td>{Number(t.derivative.toPrecision(6))}</td><td>{Number(t.coef.toPrecision(6))}</td></tr>)}</tbody></table>
      </div>
      <Button variant="outline" size="sm" onClick={() => onPreview([taylor.expr])}><Eye />Overlay on graph</Button>
      <p className="text-xs text-muted-foreground">Raise the degree and watch the polynomial hug the curve further out before bending away.</p>
    </>}
  </section>;
}
