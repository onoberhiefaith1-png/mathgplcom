// Smart Graph NodeView — a self-contained graph workspace embedded in
// the lesson note. The teacher chooses a scale, plots points by
// clicking, and chooses how to connect them. The data table is sticky
// at the top of the workspace; the SVG grid scrolls underneath.

import { useMemo, useRef, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, RefreshCw, Move } from "lucide-react";
import type { GraphPoint, ConnectStyle, SmartGraphAttrs } from "@/components/lessonnotes/extensions/SmartGraph";
import { cn } from "@/lib/utils";

const SQ = 28; // pixels per square (kept generous so the graph never feels cramped)

export function SmartGraphView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const a = node.attrs as unknown as SmartGraphAttrs;
  const update = (patch: Partial<SmartGraphAttrs>) => updateAttributes(patch as Record<string, unknown>);
  const [mode, setMode] = useState<"plot" | "pan">("plot");

  const W = a.squaresX * SQ;
  const H = a.squaresY * SQ;
  const oxPx = a.originSquareX * SQ;
  const oyPx = a.originSquareY * SQ;

  // Convert between data coords and pixel coords.
  const toPx = (p: GraphPoint) => ({
    x: oxPx + (p.x / a.unitsPerSquareX) * SQ,
    y: oyPx - (p.y / a.unitsPerSquareY) * SQ,
  });
  const toData = (px: number, py: number): GraphPoint => ({
    x: Math.round(((px - oxPx) / SQ) * a.unitsPerSquareX * 100) / 100,
    y: Math.round(((oyPx - py) / SQ) * a.unitsPerSquareY * 100) / 100,
  });

  const svgRef = useRef<SVGSVGElement>(null);
  const handleSvgClick = (e: React.MouseEvent) => {
    if (mode !== "plot" || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Snap to nearest half-square (looks like a textbook plot).
    const sx = Math.round((x / SQ) * 2) / 2 * SQ;
    const sy = Math.round((y / SQ) * 2) / 2 * SQ;
    const pt = toData(sx, sy);
    update({ points: [...a.points, pt] });
  };

  const path = useMemo(() => buildPath(a.points.map(toPx), a.connect), [a.points, a.connect, oxPx, oyPx, a.unitsPerSquareX, a.unitsPerSquareY]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tick label every square in data units.
  const xTicks: number[] = [];
  for (let i = 0; i <= a.squaresX; i++) xTicks.push(i);
  const yTicks: number[] = [];
  for (let i = 0; i <= a.squaresY; i++) yTicks.push(i);

  return (
    <NodeViewWrapper
      as="div"
      className={cn("my-4 rounded-md border bg-white text-black", selected ? "border-yellow-400 shadow" : "border-black/10")}
      data-drag-handle
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-black/10 bg-black/[0.02] text-[12px]">
        <span className="font-semibold">Smart Graph</span>
        <label className="text-[11px] text-black/60 ml-2">1 sq = </label>
        <Input
          type="number" step="0.5" value={a.unitsPerSquareX}
          onChange={(e) => update({ unitsPerSquareX: Number(e.target.value) || 1 })}
          className="h-7 w-16 text-[11px]"
        />
        <span className="text-[11px] text-black/60">unit (x)</span>
        <Input
          type="number" step="0.5" value={a.unitsPerSquareY}
          onChange={(e) => update({ unitsPerSquareY: Number(e.target.value) || 1 })}
          className="h-7 w-16 text-[11px]"
        />
        <span className="text-[11px] text-black/60">unit (y)</span>

        <Input
          value={a.xLabel} onChange={(e) => update({ xLabel: e.target.value })}
          className="h-7 w-20 text-[11px]" placeholder="x label"
        />
        <Input
          value={a.yLabel} onChange={(e) => update({ yLabel: e.target.value })}
          className="h-7 w-20 text-[11px]" placeholder="y label"
        />

        <Select value={a.connect} onValueChange={(v) => update({ connect: v as ConnectStyle })}>
          <SelectTrigger className="h-7 w-32 text-[11px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="straight">Straight line</SelectItem>
            <SelectItem value="smooth">Smooth curve</SelectItem>
            <SelectItem value="broken">Broken line</SelectItem>
            <SelectItem value="scatter">Scatter (no line)</SelectItem>
          </SelectContent>
        </Select>

        <Button size="sm" variant={mode === "plot" ? "default" : "outline"} onClick={() => setMode("plot")} className="h-7 text-[11px]">
          <Plus className="h-3 w-3 mr-1" /> Plot
        </Button>
        <Button size="sm" variant={mode === "pan" ? "default" : "outline"} onClick={() => setMode("pan")} className="h-7 text-[11px]">
          <Move className="h-3 w-3 mr-1" /> Move
        </Button>

        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => update({ points: [] })} className="h-7 text-[11px]">
            <RefreshCw className="h-3 w-3 mr-1" /> Clear
          </Button>
          <Button size="sm" variant="ghost" onClick={() => deleteNode()} className="h-7 text-[11px] text-red-600">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Sticky data table */}
      <div className="border-b border-black/10 bg-white sticky top-0 z-10">
        <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-black/50">Data</div>
        <div className="overflow-x-auto max-h-40">
          <table className="w-full text-[12px] font-mono">
            <thead className="bg-black/[0.04]">
              <tr>
                <th className="px-2 py-1 text-left w-12">#</th>
                <th className="px-2 py-1 text-left">{a.xLabel}</th>
                <th className="px-2 py-1 text-left">{a.yLabel}</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {a.points.length === 0 && (
                <tr><td colSpan={4} className="px-2 py-2 text-center text-black/40">Click in the graph below to plot points.</td></tr>
              )}
              {a.points.map((p, i) => (
                <tr key={i} className="border-t border-black/10">
                  <td className="px-2 py-0.5 text-black/50">{i + 1}</td>
                  <td className="px-2 py-0.5">
                    <input
                      type="number" value={p.x}
                      onChange={(e) => update({ points: a.points.map((pp, j) => j === i ? { ...pp, x: Number(e.target.value) } : pp) })}
                      className="w-20 bg-transparent outline-none focus:bg-yellow-50 px-1"
                    />
                  </td>
                  <td className="px-2 py-0.5">
                    <input
                      type="number" value={p.y}
                      onChange={(e) => update({ points: a.points.map((pp, j) => j === i ? { ...pp, y: Number(e.target.value) } : pp) })}
                      className="w-20 bg-transparent outline-none focus:bg-yellow-50 px-1"
                    />
                  </td>
                  <td>
                    <button onClick={() => update({ points: a.points.filter((_, j) => j !== i) })} className="text-red-500 hover:text-red-700 text-[11px] px-1">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scrolling SVG canvas */}
      <div className="overflow-auto max-h-[500px]" data-no-drag>
        <svg
          ref={svgRef}
          width={W} height={H}
          onClick={handleSvgClick}
          className={cn("bg-white", mode === "plot" && "cursor-crosshair")}
        >
          {/* Minor grid */}
          {xTicks.map((i) => (
            <line key={`vx${i}`} x1={i * SQ} y1={0} x2={i * SQ} y2={H} stroke="hsl(0 0% 90%)" strokeWidth={1} />
          ))}
          {yTicks.map((i) => (
            <line key={`vy${i}`} x1={0} y1={i * SQ} x2={W} y2={i * SQ} stroke="hsl(0 0% 90%)" strokeWidth={1} />
          ))}
          {/* Axes */}
          <line x1={0} y1={oyPx} x2={W} y2={oyPx} stroke="hsl(0 0% 25%)" strokeWidth={1.5} />
          <line x1={oxPx} y1={0} x2={oxPx} y2={H} stroke="hsl(0 0% 25%)" strokeWidth={1.5} />
          {/* Tick labels */}
          {xTicks.map((i) => {
            const val = (i - a.originSquareX) * a.unitsPerSquareX;
            if (val === 0) return null;
            return (
              <text key={`tx${i}`} x={i * SQ} y={oyPx + 12} fontSize="9" textAnchor="middle" fill="hsl(0 0% 40%)">{val}</text>
            );
          })}
          {yTicks.map((i) => {
            const val = (a.originSquareY - i) * a.unitsPerSquareY;
            if (val === 0) return null;
            return (
              <text key={`ty${i}`} x={oxPx - 4} y={i * SQ + 3} fontSize="9" textAnchor="end" fill="hsl(0 0% 40%)">{val}</text>
            );
          })}
          {/* Axis labels */}
          <text x={W - 4} y={oyPx - 4} fontSize="11" textAnchor="end" fontStyle="italic">{a.xLabel}</text>
          <text x={oxPx + 4} y={10} fontSize="11" fontStyle="italic">{a.yLabel}</text>
          {/* Path */}
          {a.connect !== "scatter" && path && (
            <path d={path} fill="none" stroke="hsl(220 90% 50%)" strokeWidth={1.75}
              strokeDasharray={a.connect === "broken" ? "6 4" : undefined}
            />
          )}
          {/* Points */}
          {a.points.map((p, i) => {
            const { x, y } = toPx(p);
            return (
              <g key={`p${i}`}>
                <circle cx={x} cy={y} r={3.5} fill="hsl(220 90% 50%)" stroke="white" strokeWidth={1} />
                <text x={x + 5} y={y - 5} fontSize="9" fill="hsl(0 0% 30%)">({p.x},{p.y})</text>
              </g>
            );
          })}
        </svg>
      </div>
    </NodeViewWrapper>
  );
}

/** Build an SVG path from pixel-space points using the chosen connect style. */
function buildPath(pts: { x: number; y: number }[], style: ConnectStyle): string | null {
  if (pts.length < 2) return null;
  if (style === "scatter") return null;
  if (style === "smooth" && pts.length >= 3) {
    // Catmull-Rom → cubic Bezier
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
  // straight + broken
  return `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");
}
