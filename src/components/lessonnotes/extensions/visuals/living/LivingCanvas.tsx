// Shared interactive SVG canvas for living diagrams. Owns pointer capture,
// handle rendering, live-label overlay, and the free-form label layer.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";
import type { Adapter } from "./shapes";
import type { Nodes } from "./geometry";
import { renderComponent } from "./constructions";
import type { LiveComponent, Visibility } from "./schema";
import { DEFAULT_VISIBILITY } from "./schema";
import type { Component } from "./panel/componentModel";
import { ComponentHitLayer } from "./panel/ComponentHitLayer";
import { ComponentOverlay } from "./panel/ComponentOverlay";
import { LabelScaleContext, BASE_FONT_PX, PAD_PX } from "./labelScale";


export type FreeLabel = { id: string; x: number; y: number; text: string };

export type PickTool = "point" | "segment" | "arc" | "circle";
export type PickedPoint = { x: number; y: number; existing?: string };

interface Props {
  adapter: Adapter;
  nodes: Nodes;
  labels: FreeLabel[];
  onNodesChange: (n: Nodes) => void;
  onLabelsChange: (l: FreeLabel[]) => void;
  selected: boolean;
  nodeLabels?: Record<string, string>;
  visibility?: Visibility;
  viewScale?: number;
  components?: LiveComponent[];
  parts?: Component[];
  selectedComponentId?: string | null;
  onSelectComponent?: (id: string | null) => void;
  pickMode?: PickTool | null;
  onPickCommit?: (tool: PickTool, points: PickedPoint[]) => void;
  onPickCancel?: () => void;
}

const VB_W = 200;
const VB_H = 140;
const PICK_COUNTS: Record<PickTool, number> = { point: 1, segment: 2, arc: 3, circle: 2 };

function newId() {
  return `l${Math.random().toString(36).slice(2, 9)}`;
}

export function LivingCanvas({
  adapter, nodes, labels, onNodesChange, onLabelsChange, selected,
  nodeLabels = {}, visibility, viewScale = 1, components = [],
  parts = [], selectedComponentId = null, onSelectComponent,
  pickMode = null, onPickCommit, onPickCancel,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [wrapperWidth, setWrapperWidth] = useState(200);
  const dragRef = useRef<{ kind: "node" | "label"; id: string } | null>(null);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [pickedSoFar, setPickedSoFar] = useState<PickedPoint[]>([]);
  const [hoverPt, setHoverPt] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    setWrapperWidth(el.getBoundingClientRect().width || 200);
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = e.contentRect.width;
        if (w > 0) setWrapperWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);


  // Reset pick buffer whenever pickMode changes.
  useEffect(() => { setPickedSoFar([]); setHoverPt(null); }, [pickMode]);

  // Escape cancels pick mode.
  useEffect(() => {
    if (!pickMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onPickCancel?.(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickMode, onPickCancel]);

  const toSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, []);

  const onPointerDownHandle = (name: string) => (e: ReactPointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { kind: "node", id: name };
  };

  const onPointerDownLabel = (id: string) => (e: ReactPointerEvent) => {
    e.stopPropagation();
    if (editingLabel === id) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { kind: "label", id };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (pickMode) {
      const { x, y } = toSvg(e.clientX, e.clientY);
      setHoverPt({ x, y });
    }
    if (!dragRef.current) return;
    const { x, y } = toSvg(e.clientX, e.clientY);
    const d = dragRef.current;
    if (d.kind === "node") {
      onNodesChange(adapter.drag(d.id, x, y, nodes));
    } else {
      onLabelsChange(labels.map(l => (l.id === d.id ? { ...l, x, y } : l)));
    }
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    if (dragRef.current) {
      try { (e.target as Element).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    }
    dragRef.current = null;
  };

  const snapToExisting = (x: number, y: number): PickedPoint => {
    for (const name of Object.keys(nodes)) {
      const p = nodes[name];
      if (Math.hypot(p.x - x, p.y - y) <= 5) return { x: p.x, y: p.y, existing: name };
    }
    return { x, y };
  };

  const handlePickClick = (e: ReactMouseEvent) => {
    if (!pickMode) return;
    e.stopPropagation();
    const { x, y } = toSvg(e.clientX, e.clientY);
    const pt = snapToExisting(x, y);
    const next = [...pickedSoFar, pt];
    const needed = PICK_COUNTS[pickMode];
    if (next.length >= needed) {
      setPickedSoFar([]);
      onPickCommit?.(pickMode, next);
    } else {
      setPickedSoFar(next);
    }
  };

  const onDoubleClick = (e: ReactMouseEvent) => {
    if (pickMode) return;
    // Only if the click landed on the SVG background (not a handle/label).
    if (e.target !== svgRef.current) return;
    const { x, y } = toSvg(e.clientX, e.clientY);
    const id = newId();
    onLabelsChange([...labels, { id, x, y, text: "" }]);
    setEditingLabel(id);
  };

  const { svg, handles, liveLabels } = adapter.render(nodes);
  const vis = { ...DEFAULT_VISIBILITY, ...(visibility ?? {}) };
  const visibleLiveLabels = liveLabels.filter((label) => {
    if (!vis.sideLabels && !vis.angleLabels && !vis.dimensions) return false;
    // Suppress base line-length labels for any line that has a component
    // — the ComponentOverlay renders those instead (offset outward).
    return !parts.some((part) => {
      if (part.kind !== "line" || part.nodes?.length !== 2) return false;
      const a = nodes[part.nodes[0]];
      const b = nodes[part.nodes[1]];
      if (!a || !b) return false;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      return Math.hypot(label.x - mx, label.y - my) < 8;
    });
  });

  // Build preview geometry from picks + current hover.
  const previewPts = pickMode && hoverPt ? [...pickedSoFar, hoverPt] : pickedSoFar;

  // Auto-fit viewBox to the bounding box of all nodes + preview picks so
  // extended sides / added constructions don't get clipped. Fall back to
  // the classic 200×140 box when the diagram is very small.
  const allPts: { x: number; y: number }[] = [
    ...Object.values(nodes),
    ...previewPts.map((p) => ({ x: p.x, y: p.y })),
  ];
  const PAD = 28;
  let minX = 0, minY = 0, maxX = VB_W, maxY = VB_H;
  if (allPts.length > 0) {
    minX = Math.min(...allPts.map((p) => p.x)) - PAD;
    minY = Math.min(...allPts.map((p) => p.y)) - PAD;
    maxX = Math.max(...allPts.map((p) => p.x)) + PAD;
    maxY = Math.max(...allPts.map((p) => p.y)) + PAD;
    // Ensure at least the default footprint so tiny diagrams stay readable.
    if (maxX - minX < VB_W) { const c = (minX + maxX) / 2; minX = c - VB_W / 2; maxX = c + VB_W / 2; }
    if (maxY - minY < VB_H) { const c = (minY + maxY) / 2; minY = c - VB_H / 2; maxY = c + VB_H / 2; }
  }
  const vbW = maxX - minX;
  const vbH = maxY - minY;

  // Independent label scaling: SVG-units per rendered CSS pixel. When the
  // viewBox grows (extended sides), unitsPerPixel grows too, so pixel-based
  // sizes stay constant on screen.
  const unitsPerPixel = vbW / Math.max(1, wrapperWidth * viewScale);
  const scaleValue = useMemo(() => ({ unitsPerPixel }), [unitsPerPixel]);
  const fontSvg = BASE_FONT_PX * unitsPerPixel;
  const strokeSvg = 2 * unitsPerPixel;
  const nameOffset = (PAD_PX + 2) * unitsPerPixel;

  return (
    <div ref={wrapperRef} style={{ width: "100%" }}>
    <LabelScaleContext.Provider value={scaleValue}>
    <svg
      ref={svgRef}
      viewBox={`${minX} ${minY} ${vbW} ${vbH}`}
      className="w-full h-auto touch-none select-none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        transform: viewScale !== 1 ? `scale(${viewScale})` : undefined,
        transformOrigin: "center",
        cursor: pickMode ? "crosshair" : undefined,
        overflow: "visible",
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      onClick={handlePickClick}
      onContextMenu={(e) => { if (pickMode) { e.preventDefault(); onPickCancel?.(); } }}
    >
      {/* transparent background — catches double-clicks + clears component selection */}
      <rect x={minX} y={minY} width={vbW} height={vbH} fill="transparent"
        onPointerDown={() => { if (!pickMode) onSelectComponent?.(null); }} />



      {/* the shape itself, non-interactive so handles win pointer events */}
      <g style={{ pointerEvents: "none" }}>{svg}</g>

      {/* per-component appearance overrides (thickness, colour, dash, visibility) */}
      <ComponentOverlay components={parts} nodes={nodes} showLineLabels={vis.sideLabels || vis.dimensions} />

      {/* added components (altitudes, ticks, measurements…) */}
      {vis.construction && (
        <g style={{ pointerEvents: "none" }}>
          {components.map(c => renderComponent(c, nodes))}
        </g>
      )}

      {/* click targets for per-component selection */}
      {onSelectComponent && (
        <ComponentHitLayer
          components={parts}
          nodes={nodes}
          selectedId={selectedComponentId ?? null}
          onSelect={onSelectComponent}
        />
      )}

      {/* renamed vertex labels — placed outward from the polygon centroid */}
      <g style={{ pointerEvents: "none", fill: "currentColor" }}>
        {(() => {
          const pts = Object.values(nodes);
          const cx = pts.length ? pts.reduce((s, p) => s + p.x, 0) / pts.length : 0;
          const cy = pts.length ? pts.reduce((s, p) => s + p.y, 0) / pts.length : 0;
          return Object.keys(nodes).map(name => {
            const label = nodeLabels[name] ?? name;
            const p = nodes[name];
            let dx = p.x - cx, dy = p.y - cy;
            const d = Math.hypot(dx, dy) || 1;
            dx /= d; dy /= d;
            // Vertex-label lives outside the point, along the outward radial.
            const off = nameOffset + fontSvg * 0.6;
            return (
              <text key={`nl${name}`} x={p.x + dx * off} y={p.y + dy * off}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={fontSvg}
                style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: strokeSvg * 1.5, fontWeight: 700 }}>
                {label}
              </text>
            );
          });
        })()}
      </g>

      {/* auto-computed live labels (side lengths, angles) */}
      {(vis.sideLabels || vis.angleLabels || vis.dimensions) && (
        <g style={{ pointerEvents: "none", fill: "currentColor" }}>
          {visibleLiveLabels.map((l, i) => (
            <text key={`ll${i}`} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle"
              fontSize={fontSvg}
              style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: strokeSvg }}>
              {l.text}
            </text>
          ))}
        </g>
      )}


      {/* free-form labels: foreignObject so they're editable HTML */}
      {labels.map(l => (
        <foreignObject
          key={l.id}
          x={l.x - 40} y={l.y - 10} width={80} height={22}
          style={{ overflow: "visible", pointerEvents: "auto" }}
        >
          <div
            onPointerDown={onPointerDownLabel(l.id)}
            onDoubleClick={(ev) => { ev.stopPropagation(); setEditingLabel(l.id); }}
            style={{
              width: "100%", height: "100%", display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: 9, cursor: editingLabel === l.id ? "text" : "move",
              color: "hsl(var(--foreground))",
            }}
          >
            {editingLabel === l.id ? (
              <input
                autoFocus
                value={l.text}
                onChange={(ev) => onLabelsChange(labels.map(x => x.id === l.id ? { ...x, text: ev.target.value } : x))}
                onBlur={(ev) => {
                  setEditingLabel(null);
                  if (!ev.target.value.trim()) {
                    onLabelsChange(labels.filter(x => x.id !== l.id));
                  }
                }}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === "Escape") {
                    ev.preventDefault();
                    (ev.target as HTMLInputElement).blur();
                  }
                }}
                style={{
                  width: "100%", textAlign: "center", background: "hsl(var(--background))",
                  border: "1px solid hsl(var(--primary))", borderRadius: 3,
                  fontSize: 9, padding: "0 2px", outline: "none",
                }}
              />
            ) : (
              <span style={{
                padding: "0 3px", borderRadius: 2,
                background: "hsl(var(--background) / 0.85)",
              }}>{l.text || "…"}</span>
            )}
          </div>
        </foreignObject>
      ))}

      {/* drag handles (only when selected) */}
      {selected && (
        <g>
          {handles.map(hd => (
            <circle
              key={hd.name}
              cx={hd.x} cy={hd.y} r={4}
              fill="hsl(var(--primary))"
              stroke="hsl(var(--background))"
              strokeWidth={1.5}
              style={{ cursor: "grab" }}
              onPointerDown={onPointerDownHandle(hd.name)}
            />
          ))}
        </g>
      )}

      {/* pick-mode preview */}
      {pickMode && (
        <g style={{ pointerEvents: "none" }}>
          {pickedSoFar.map((p, i) => (
            <circle key={`pk${i}`} cx={p.x} cy={p.y} r={2.6}
              fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth={1} />
          ))}
          {pickMode === "segment" && previewPts.length === 2 && (
            <line x1={previewPts[0].x} y1={previewPts[0].y} x2={previewPts[1].x} y2={previewPts[1].y}
              stroke="hsl(var(--primary))" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7} />
          )}
          {pickMode === "circle" && previewPts.length === 2 && (
            <circle cx={previewPts[0].x} cy={previewPts[0].y}
              r={Math.hypot(previewPts[1].x - previewPts[0].x, previewPts[1].y - previewPts[0].y)}
              fill="none" stroke="hsl(var(--primary))" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7} />
          )}
          {pickMode === "arc" && previewPts.length >= 2 && (
            <polyline points={previewPts.map(p => `${p.x},${p.y}`).join(" ")}
              fill="none" stroke="hsl(var(--primary))" strokeWidth={1.2} strokeDasharray="3 3" opacity={0.7} />
          )}
          {hoverPt && (
            <circle cx={hoverPt.x} cy={hoverPt.y} r={1.6} fill="hsl(var(--primary))" opacity={0.9} />
          )}
        </g>
      )}
    </svg>
    </LabelScaleContext.Provider>
    </div>
  );
}

