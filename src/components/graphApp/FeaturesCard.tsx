import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { curveFeatures } from "@/lib/graphApp/interpret";
import type { Fn } from "@/lib/graphApp/math";
import { verifyCurve } from "@/lib/graphApp/verify";

const n = (v: number) => String(Math.round(v * 1000) / 1000);

/** Key features + coordinate table of a curve, computed by the engine. */
export default function FeaturesCard({ src, f }: { src: string; f: Fn }) {
  const [open, setOpen] = useState(true);
  const c = useMemo(() => curveFeatures(f), [f]);
  const v = useMemo(() => verifyCurve(f, c), [f, c]);
  return (
    <div className="absolute bottom-2 left-2 z-10 w-64 rounded-xl border bg-card/95 p-3 text-sm shadow-lg max-sm:bottom-20 max-sm:w-56">
      <button className="flex w-full items-center justify-between font-semibold" onClick={() => setOpen(o => !o)} aria-label="Toggle key features">
        <span className="truncate font-mono">{src}</span>{open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>
      {open && <div className="mt-2 space-y-1 text-xs">
        <p><b>Roots:</b> {c.roots.length ? c.roots.map(r => `x = ${n(r)}`).join(", ") : "none in −10 ≤ x ≤ 10"}</p>
        <p><b>y-intercept:</b> {c.yIntercept === null ? "undefined" : `(0, ${n(c.yIntercept)})`}</p>
        {c.turning.map((t, i) => <p key={i}><b>Turning point:</b> ({n(t.x)}, {n(t.y)}) — {t.type}</p>)}
        {c.axisOfSymmetry !== null && <p><b>Axis of symmetry:</b> x = {n(c.axisOfSymmetry)}</p>}
        <p className={v.ok ? "text-primary" : "text-destructive"} title={v.checks.map(k => `${k.ok ? "✓" : "✗"} ${k.label} (${k.detail})`).join("\n")}>
          <b>{v.ok ? "✓ Checked:" : "✗ Check failed:"}</b> {v.ok ? `${v.checks.length} result${v.checks.length === 1 ? "" : "s"} substituted back into the equation` : v.checks.filter(k => !k.ok).map(k => k.label).join("; ")}
        </p>
        {v.warnings.map((w, i) => <p key={i} className="text-muted-foreground">⚠ {w}</p>)}
        <table className="mt-1 w-full border-collapse font-mono">
          <thead><tr className="border-b text-left"><th>x</th><th>y</th><th>point</th></tr></thead>
          <tbody>{c.table.map(r => <tr key={r.x}><td>{r.x}</td><td>{r.y ?? "—"}</td><td>{r.y === null ? "undefined" : `(${r.x}, ${r.y})`}</td></tr>)}</tbody>
        </table>
      </div>}
    </div>
  );
}
