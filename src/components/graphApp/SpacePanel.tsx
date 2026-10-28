// Math Lab Stage 5 — 3D tools: plane intersections, 3×3 systems, cross-sections.
import { useEffect, useMemo, useState } from "react";
import { Box, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Item } from "./Graph2D";
import { crossSection, describeLine, intersectPlanes, lineEquation, planeOf, planeText, solveThree } from "@/lib/graphApp/space";

const fmt = (v: number) => (Math.abs(v) < 1e-10 ? "0" : Number(v.toPrecision(8)).toString());

export default function SpacePanel({ items, onPlot, onPlotMany, onSection, onClose }: {
  items: Item[]; onPlot: (src: string) => void; onPlotMany: (srcs: string[]) => void;
  onSection: (segs: [number, number, number][][] | null) => void; onClose: () => void;
}) {
  const visible = items.filter((i) => !i.hidden);
  const planes = visible.map((i) => ({ item: i, plane: planeOf(i.eq) })).filter((p): p is { item: Item; plane: NonNullable<ReturnType<typeof planeOf>> } => !!p.plane);
  const surfaces = visible.filter((i) => i.eq.kind === "surface" && !planeOf(i.eq));
  const [lines, setLines] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [surfaceId, setSurfaceId] = useState<string>("");
  const [h, setH] = useState(1);
  const surface = surfaces.find((s) => s.id === surfaceId) ?? surfaces[0];

  const segs = useMemo(() => (surface && surface.eq.kind === "surface" ? crossSection(surface.eq.f, h) : null), [surface, h]);
  useEffect(() => { onSection(segs); }, [segs, onSection]);
  useEffect(() => () => onSection(null), [onSection]);

  const run = (fn: () => string[]) => { try { setLines(fn()); setError(null); } catch (e) { setLines(null); setError(e instanceof Error ? e.message : "Unable to calculate."); } };

  const meetTwo = () => run(() => {
    if (planes.length < 2) throw Error("Plot at least two planes, e.g. x + y + z = 6 and x − y + 0z = 0.");
    const [a, b] = planes;
    const m = intersectPlanes(a.plane, b.plane);
    const head = [`Plane 1: ${planeText(a.plane)}`, `Plane 2: ${planeText(b.plane)}`];
    if (m.kind === "parallel") return [...head, "The normals are parallel and the planes are distinct: they never meet."];
    if (m.kind === "same") return [...head, "These are the same plane: every point is shared."];
    onPlot(lineEquation(m));
    return [...head, "Direction = n₁ × n₂", `They meet in the line ${describeLine(m)}`, "The line has been drawn in the scene."];
  });

  const meetThree = () => run(() => {
    if (planes.length < 3) throw Error("Plot three planes to solve a 3×3 system.");
    const [a, b, c] = planes;
    const r = solveThree([a.plane, b.plane, c.plane]);
    const head = [a, b, c].map((p, i) => `(${i + 1}) ${planeText(p.plane)}`);
    if (r.kind === "none") return [...head, "det = 0 and the system is inconsistent: no point lies on all three planes."];
    if (r.kind === "infinite") return [...head, "det = 0 and the equations are dependent: infinitely many solutions (the planes share a line or coincide)."];
    const [x, y, z] = r.point;
    onPlot(`(${fmt(x)}, ${fmt(y)}, ${fmt(z)})`);
    return [...head, "det ≠ 0, so there is exactly one solution (Cramer's rule):", `x = ${fmt(x)}, y = ${fmt(y)}, z = ${fmt(z)}`];
  });

  return <section aria-label="3D tools" className="absolute inset-y-0 right-0 z-30 flex w-[min(400px,100%)] flex-col gap-4 overflow-y-auto border-l bg-card p-4 shadow-lg">
    <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><Box className="h-4 w-4" />3D tools</h2><Button variant="ghost" size="icon-sm" aria-label="Close 3D tools" onClick={onClose}><X /></Button></div>

    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Planes in the scene ({planes.length})</h3>
      {planes.length ? <ul className="space-y-1 font-mono text-sm">{planes.map((p) => <li key={p.item.id} className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: p.item.colour }} />{planeText(p.plane)}</li>)}</ul>
        : <p className="text-sm text-muted-foreground">Plot equations like <code>2x + y - z = 4</code>.</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={meetTwo}>Where two planes meet</Button>
        <Button variant="outline" size="sm" onClick={meetThree}>Solve three planes</Button>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <button className="underline" onClick={() => { onPlotMany(["x + y + z = 6", "2x - y + z = 3", "x + 2y - z = 2"]); }}>Example: three planes meeting at a point</button>
      </div>
    </div>

    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Cross-section of a surface</h3>
      {surfaces.length ? <>
        <select aria-label="Surface to slice" className="h-9 w-full rounded-md border bg-background px-2 font-mono text-sm" value={surface?.id} onChange={(e) => setSurfaceId(e.target.value)}>
          {surfaces.map((s) => <option key={s.id} value={s.id}>{s.eq.src}</option>)}
        </select>
        <label className="block space-y-1 text-sm">Slice at height z = {fmt(h)}
          <input aria-label="Slice height" type="range" min={-5} max={5} step={0.1} value={h} onChange={(e) => setH(Number(e.target.value))} className="w-full" />
        </label>
        <p className="text-xs text-muted-foreground">{segs?.length ? "The yellow curve is every point on the surface at this height." : "The surface does not reach this height."}</p>
      </> : <p className="text-sm text-muted-foreground">Plot a surface such as <code>z = x^2 + y^2</code> to slice it.</p>}
    </div>

    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {lines && <output aria-label="3D result" className="space-y-1 rounded-md border bg-muted p-3 font-mono text-sm">{lines.map((l, i) => <div key={i}>{l}</div>)}</output>}
  </section>;
}
