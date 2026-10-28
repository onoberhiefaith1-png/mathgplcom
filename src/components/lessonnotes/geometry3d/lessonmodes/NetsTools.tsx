// Lesson Mode: Nets — the 2D unfolding of the selected solid with a
// fold / unfold control and hover-linking between the net and the 3D solid.

import { useMemo, useState } from "react";
import { Layers } from "lucide-react";
import { netFor, type NetShape } from "@/lib/geometry3d/nets";
import { topologyFor } from "@/lib/geometry3d/topology";
import { faceArea } from "@/lib/geometry3d/measure";
import { shapeMath, type Dimension } from "@/lib/geometry3d/formulaLibrary";
import { formatMeasure } from "@/lib/geometry3d/units";
import type { Solid3D } from "@/lib/geometry3d/scene3d";
import { PanelSection, UnitControls, DimensionEditor, TeachingNotes } from "./TeachingPanelKit";

type P = [number, number];

interface Props {
  solid: Solid3D | null;
  unit: string;
  setUnit: (u: string) => void;
  decimals: number;
  setDecimals: (n: number) => void;
  onParam: (key: string, rawValue: number) => void;
  /** Highlight the matching face in the 3D scene. */
  onHoverFace?: (faceIndex: number | null) => void;
}

const centroidOf = (pts: P[]): P => [
  pts.reduce((a, b) => a + b[0], 0) / pts.length,
  pts.reduce((a, b) => a + b[1], 0) / pts.length,
];

/**
 * Orthographic fold preview: each flap rotates about its hinge edge, so seen
 * from above every point moves towards the hinge by a factor of cos θ.
 */
function foldPoints(points: P[], anchor: P, cos: number): P[] {
  // hinge = the edge whose midpoint is closest to the anchor face's centre
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const m: P = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const d = Math.hypot(m[0] - anchor[0], m[1] - anchor[1]);
    if (d < bestD) { bestD = d; best = i; }
  }
  const a = points[best];
  const b = points[(best + 1) % points.length];
  const ex = b[0] - a[0], ey = b[1] - a[1];
  const len = Math.hypot(ex, ey) || 1;
  const ux = ex / len, uy = ey / len;
  return points.map(([x, y]) => {
    const dx = x - a[0], dy = y - a[1];
    const along = dx * ux + dy * uy;
    const perpX = dx - along * ux;
    const perpY = dy - along * uy;
    return [a[0] + along * ux + perpX * cos, a[1] + along * uy + perpY * cos] as P;
  });
}

export function NetsTools({ solid, unit, setUnit, decimals, setDecimals, onParam, onHoverFace }: Props) {
  const [fold, setFold] = useState(0);
  const net = solid ? netFor(solid) : null;
  const m = solid ? shapeMath(solid) : null;
  const topo = solid ? topologyFor(solid) : null;
  const cos = Math.cos((fold * Math.PI) / 2);

  const anchor: P = useMemo(() => {
    if (!net) return [0, 0];
    const big = [...net.shapes]
      .filter((s) => s.kind === "polygon" && s.points)
      .sort((a, b) => (b.points!.length) - (a.points!.length))[0];
    const target = net.shapes.find((s) => s.label === "Base" || s.label === "Front") ?? big ?? net.shapes[0];
    if (target?.points) return centroidOf(target.points as P[]);
    if (target?.cx != null && target?.cy != null) return [target.cx, target.cy];
    return [net.width / 2, net.height / 2];
  }, [net]);

  const setDim = (key: string, value: number) => {
    if (!m) return;
    const d = m.dimensions.find((x) => x.key === key) as Dimension | undefined;
    onParam(key, d ? value / (d.scaleFactor || 1) : value);
  };

  const areaOf = (s: NetShape) =>
    s.faceIndex != null && topo && solid && topo.faces[s.faceIndex]
      ? faceArea(solid, topo.faces[s.faceIndex])
      : null;

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-y-auto border-l border-foreground/10 bg-background p-3">
      <div className="flex items-center gap-1.5">
        <Layers className="h-4 w-4" />
        <p className="text-sm font-semibold">Net{m ? ` · ${m.name}` : ""}</p>
      </div>

      {!solid && <p className="text-xs text-muted-foreground">Pick a solid to see its net.</p>}
      {solid && !net && <p className="text-xs text-muted-foreground">A sphere (or frustum) has no flat net that can be drawn exactly.</p>}

      {net && (
        <>
          <div className="rounded-md border border-border bg-muted/40 p-2">
            <svg viewBox={`0 0 ${net.width} ${net.height}`} className="h-auto w-full">
              {net.shapes.map((s, i) => {
                const hover = () => onHoverFace?.(s.faceIndex ?? null);
                const leave = () => onHoverFace?.(null);
                if (s.kind === "polygon" && s.points) {
                  const pts = foldPoints(s.points as P[], anchor, cos);
                  const [cx, cy] = centroidOf(pts);
                  return (
                    <g key={i} onMouseEnter={hover} onMouseLeave={leave} style={{ cursor: "pointer" }}>
                      <polygon
                        points={pts.map((p) => p.join(",")).join(" ")}
                        fill={s.color} fillOpacity={0.55} stroke={s.color} strokeWidth={1.2}
                      />
                      {fold < 0.6 && (
                        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#0f172a" fontWeight={600}>
                          {s.label}
                        </text>
                      )}
                    </g>
                  );
                }
                if (s.kind === "circle" && s.cx != null && s.cy != null && s.r != null) {
                  const dx = (s.cx - anchor[0]) * cos + anchor[0];
                  const dy = (s.cy - anchor[1]) * cos + anchor[1];
                  return (
                    <g key={i} onMouseEnter={hover} onMouseLeave={leave} style={{ cursor: "pointer" }}>
                      <ellipse cx={dx} cy={dy} rx={s.r} ry={s.r * Math.max(0.05, cos)} fill={s.color} fillOpacity={0.55} stroke={s.color} strokeWidth={1.2} />
                      {fold < 0.6 && (
                        <text x={dx} y={dy} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#0f172a" fontWeight={600}>{s.label}</text>
                      )}
                    </g>
                  );
                }
                return null;
              })}
            </svg>
          </div>

          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            <span className="flex items-center justify-between">
              <span>Fold</span>
              <span className="font-mono text-foreground">{Math.round(fold * 90)}°</span>
            </span>
            <input type="range" min={0} max={1} step={0.02} value={fold}
              onChange={(e) => setFold(Number(e.target.value))} className="accent-primary" />
            <span className="flex gap-1">
              <button type="button" onClick={() => setFold(0)} className="flex-1 rounded bg-muted px-2 py-1 text-[10px] hover:bg-muted/80">Unfold</button>
              <button type="button" onClick={() => setFold(1)} className="flex-1 rounded bg-muted px-2 py-1 text-[10px] hover:bg-muted/80">Fold up</button>
            </span>
          </label>

          <PanelSection title="Faces in the net">
            <div className="space-y-0.5">
              {net.shapes.map((s, i) => {
                const a = areaOf(s);
                return (
                  <div
                    key={i}
                    onMouseEnter={() => onHoverFace?.(s.faceIndex ?? null)}
                    onMouseLeave={() => onHoverFace?.(null)}
                    className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-[11px] hover:bg-muted/60"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                      {s.label}
                    </span>
                    <span className="font-medium">{a != null ? formatMeasure(a, unit, decimals, 2) : "—"}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Hover a face to highlight the matching face on the 3D solid.
            </p>
          </PanelSection>

          {net.notes && <p className="text-[11px] text-muted-foreground">{net.notes}</p>}
        </>
      )}

      {m && (
        <>
          <PanelSection title="Dimensions (editable)">
            <DimensionEditor dimensions={m.dimensions} unit={unit} decimals={decimals} onChange={setDim} />
          </PanelSection>
          <PanelSection title="Teaching information" defaultOpen={false}>
            <TeachingNotes
              why="A net is the solid opened out flat: every face keeps its true size, which is why the net gives the surface area directly."
              how={["Identify each face of the solid.", "Draw each face full size, joined along shared edges.", "Add the face areas to get the surface area."]}
              notes={m.notes}
              mistakes={["Drawing a net with overlapping faces.", "Missing a hidden face when counting."]}
            />
          </PanelSection>
          <PanelSection title="Units & precision" defaultOpen={false}>
            <UnitControls unit={unit} setUnit={setUnit} decimals={decimals} setDecimals={setDecimals} />
          </PanelSection>
        </>
      )}
    </div>
  );
}
export default NetsTools;
