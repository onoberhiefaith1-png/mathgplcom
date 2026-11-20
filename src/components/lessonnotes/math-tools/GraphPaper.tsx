import { useMemo } from "react";
import { gridLines, toPx, visibleBounds, type DigitalView } from "@/lib/graph/digitalView";
import { tryCompile, sampleFunction } from "@/lib/graph/functions";
import type { GraphInk } from "@/lib/graph/graphTheme";
import type { ConnectStyle, SmartGraphAttrs } from "@/lib/graph/graphModel";

function round(v: number) { return Math.round(v * 100) / 100; }

function buildPath(pts: { x: number; y: number }[], style: ConnectStyle): string | null {
  if (pts.length < 2) return null;
  if (style === "scatter") return null;
  if (style === "smooth" && pts.length >= 3) {
    const d: string[] = [`M ${pts[0].x} ${pts[0].y}`];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] ?? p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d.push(`C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`);
    }
    return d.join(" ");
  }
  return `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");
}

export function GraphPaper({ attrs: a, view, width: W, height: H, ink, connect = a.connect, movingAxis }: {
  attrs: SmartGraphAttrs; view: DigitalView; width: number; height: number; ink: GraphInk;
  connect?: ConnectStyle; movingAxis?: "x" | "y";
}) {
  const style = a.style;
  const axisWidth = style?.axisWidth ?? 2;
  const functions = a.functions ?? [];
  const toScreen = (point: { x: number; y: number }) => toPx(point, view, W, H);
  const oxPx = toScreen({ x: 0, y: 0 }).x;
  const oyPx = toScreen({ x: 0, y: 0 }).y;
  const ticks = useMemo(() => gridLines(view, W, H), [view, W, H]);
  const path = useMemo(() => buildPath((a.points ?? []).map(toScreen), connect), [a.points, view, W, H, connect]);
  const { x0: dataX0, x1: dataX1, y0: dataY0, y1: dataY1 } = visibleBounds(view, W, H);
  const fnPaths = useMemo(() => {
    return functions.filter((f) => !f.hidden).map((f) => {
      const { fn } = tryCompile(f.expression);
      if (!fn) return { f, d: [] as string[] };
      const x0 = Math.max(dataX0, f.domainMin ?? dataX0);
      const x1 = Math.min(dataX1, f.domainMax ?? dataX1);
      if (!(x1 > x0)) return { f, d: [] as string[] };
      const segs = sampleFunction(fn, x0, x1, { yMin: dataY0, yMax: dataY1, samples: Math.max(200, Math.round(W)) });
      const d = segs.map((seg) => seg.map((pt, i) => {
        const q = toScreen(pt);
        return `${i === 0 ? "M" : "L"} ${q.x} ${q.y}`;
      }).join(" "));
      return { f, d };
    });
  }, [functions, dataX0, dataX1, dataY0, dataY1, W, H, view]); // eslint-disable-line react-hooks/exhaustive-deps


  return (
    <>
                {/* Adaptive 1-2-5 major / 5-minor digital grid */}
                {ticks.vertical.map((l, i) => (
                  <line key={`mx${i}`} x1={l.pos} y1={0} x2={l.pos} y2={H}
                    stroke={l.major ? ink.majorGrid : ink.minorGrid}
                    strokeWidth={l.major ? 1 : 0.5} />
                ))}
                {ticks.horizontal.map((l, i) => (
                  <line key={`my${i}`} x1={0} y1={l.pos} x2={W} y2={l.pos}
                    stroke={l.major ? ink.majorGrid : ink.minorGrid}
                    strokeWidth={l.major ? 1 : 0.5} />
                ))}

                {/* Axes */}
                <line x1={0} y1={oyPx} x2={W} y2={oyPx}
                  stroke={movingAxis === "x" ? "hsl(45 95% 50%)" : ink.axis}
                  strokeWidth={movingAxis === "x" ? axisWidth + 0.4 : axisWidth} />
                <line x1={oxPx} y1={0} x2={oxPx} y2={H}
                  stroke={movingAxis === "y" ? "hsl(45 95% 50%)" : ink.axis}
                  strokeWidth={movingAxis === "y" ? axisWidth + 0.4 : axisWidth} />

                {/* Tick labels (major steps only) */}
                {ticks.vertical.filter((l) => l.major && Math.abs(l.world) > 1e-9).map((l, i) => (
                  <text key={`tx${i}`} x={l.pos} y={Math.min(H - 2, Math.max(12, oyPx + 12))} fontSize="9.5" textAnchor="middle" fill={ink.text}>{round(l.world)}</text>
                ))}
                {ticks.horizontal.filter((l) => l.major && Math.abs(l.world) > 1e-9).map((l, i) => (
                  <text key={`ty${i}`} x={Math.max(4, oxPx - 4)} y={l.pos + 3} fontSize="9.5" textAnchor="end" fill={ink.text}>{round(l.world)}</text>
                ))}

                <text x={W - 6} y={oyPx - 6} fontSize="11" textAnchor="end" fontStyle="italic" fill={ink.label}>{a.xLabel}</text>
                <text x={oxPx + 6} y={12} fontSize="11" fontStyle="italic" fill={ink.label}>{a.yLabel}</text>

                {/* Plotted functions */}
                {fnPaths.map(({ f, d }) => (
                  <g key={f.id}>
                    {d.map((seg, i) => (
                      <path key={i} d={seg} fill="none" stroke={f.colour} strokeWidth={f.thickness}
                        strokeDasharray={f.dash === "dashed" ? "6 4" : f.dash === "dotted" ? "2 3" : undefined} />
                    ))}
                  </g>
                ))}

                {/* Plotted line + points */}
                {connect !== "scatter" && path && (
                  <path d={path} fill="none" stroke={ink.ink} strokeWidth={style?.plotWidth ?? 1.75}
                    strokeDasharray={connect === "broken" ? "6 4" : undefined} />
                )}
                {(a.points ?? []).map((p, i) => {
                  const { x, y } = toScreen(p);
                  return (
                    <g key={`p${i}`}>
                      <circle cx={x} cy={y} r={style?.pointSize ?? 3.5} fill={ink.ink} stroke={ink.bg} strokeWidth={1} />
                      <text x={x + 5} y={y - 5} fontSize="9" fill={ink.text}>({p.x},{p.y})</text>
                    </g>
                  );
                })}


    </>
  );
}
