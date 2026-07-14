// SVG renderer + interaction for the Universal Venn Engine.

import { useEffect, useMemo, useRef, useState } from "react";
import type { UCEVennModel, VennSet, RegionOverride } from "./types";
import { solveLayout } from "./solver";
import { regionCentroid, regionKeyAt } from "./regions";

interface Props {
  model: UCEVennModel;
  selectedRegion: string | null;
  selectedSet: string | null;
  onSelectRegion: (key: string | null) => void;
  onSelectSet: (id: string | null) => void;
  onChange: (m: UCEVennModel) => void;
  editable: boolean;
}

type Drag =
  | { kind: "move"; id: "A" | "B" | "C"; ox: number; oy: number }
  | { kind: "radius"; id: "A" | "B" | "C" };

export function VennEngineCanvas({ model, selectedRegion, selectedSet, onSelectRegion, onSelectSet, onChange, editable }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);
  const modelRef = useRef(model);
  const onChangeRef = useRef(onChange);
  useEffect(() => { modelRef.current = model; }, [model]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const solved = useMemo(() => {
    const placed = solveLayout(model) as unknown as Record<string, VennSet | undefined>;
    const sets: VennSet[] = model.sets.map((s) => placed[s.id] ?? s);
    return sets;
  }, [model]);

  const clientToSvg = (cx: number, cy: number) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = cx; pt.y = cy;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: cx, y: cy };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const beginDrag = (e: React.PointerEvent, drag: Drag) => {
    if (!editable) return;
    e.stopPropagation();
    dragRef.current = drag;
    setDragging(true);
    onSelectSet(drag.id);
    onSelectRegion(null);
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const p = clientToSvg(ev.clientX, ev.clientY);
      const m = modelRef.current;
      const sets = m.sets.map((s) => {
        if (s.id !== d.id) return s;
        if (d.kind === "move") {
          const dx = p.x - d.ox, dy = p.y - d.oy;
          dragRef.current = { ...d, ox: p.x, oy: p.y };
          return { ...s, cx: s.cx + dx, cy: s.cy + dy, manualPlacement: true };
        }
        if (d.kind === "radius") {
          const r = Math.max(12, Math.hypot(p.x - s.cx, p.y - s.cy));
          return { ...s, radius: r };
        }
        return s;
      });
      onChangeRef.current({ ...m, sets });
    };
    const up = () => { dragRef.current = null; setDragging(false); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragging]);

  const visibleSets = solved.filter((s) => s.visible);
  const u = model.universe;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${model.width} ${model.height}`}
      width={model.width}
      height={model.height}
      onPointerDown={(e) => {
        if (!editable) return;
        if (e.target === svgRef.current) {
          onSelectSet(null);
          onSelectRegion(null);
          return;
        }
      }}
      style={{ display: "block", touchAction: "none", userSelect: "none", overflow: "visible" }}
    >
      {u.show && (
        <rect x={u.padding / 2} y={u.padding / 2}
          width={model.width - u.padding} height={model.height - u.padding}
          stroke={u.borderColour} strokeWidth={u.border}
          fill={u.background === "none" ? "none" : u.background}
          fillOpacity={u.background === "none" ? 0 : u.backgroundOpacity}
          pointerEvents="none" />
      )}

      {/* region overrides — drawn first so circles overlay them */}
      {model.regions.map((r) => (
        <RegionShade key={r.key} region={r} sets={visibleSets} />
      ))}

      {/* circles */}
      {visibleSets.map((s) => {
        const isSel = selectedSet === s.id;
        return (
          <g key={s.id}>
            <circle cx={s.cx} cy={s.cy} r={s.radius}
              fill={s.fill === "none" ? "none" : s.fill}
              fillOpacity={s.fill === "none" ? 0 : s.fillOpacity}
              stroke={s.colour} strokeWidth={s.thickness}
              onPointerDown={(e) => {
                const p = clientToSvg(e.clientX, e.clientY);
                // If the click is inside multiple sets it's a region click, not a body drag.
                const key = regionKeyAt(p.x, p.y, visibleSets);
                if (key.length > 1 && editable) {
                  e.stopPropagation();
                  onSelectRegion(key);
                  onSelectSet(null);
                  return;
                }
                beginDrag(e, { kind: "move", id: s.id, ox: p.x, oy: p.y });
              }}
              style={{ cursor: editable ? "grab" : "default" }} />
            {/* set label */}
            <text x={s.cx} y={s.cy - s.radius - 6}
              fontSize={13} fill={s.colour} fontWeight={600}
              textAnchor="middle" pointerEvents="none">
              {s.label}
            </text>

            {isSel && editable && (
              <>
                <circle cx={s.cx} cy={s.cy} r={s.radius}
                  stroke="hsl(var(--primary))" strokeWidth={s.thickness + 4}
                  fill="none" opacity={0.15} pointerEvents="none" />
                <Handle x={s.cx + s.radius} y={s.cy}
                  onDown={(e) => beginDrag(e, { kind: "radius", id: s.id })}
                  title="Drag to resize" />
              </>
            )}
          </g>
        );
      })}

      {/* region text overlays */}
      {model.regions.map((r) => {
        if (!r.text) return null;
        const c = regionCentroid(r.key, visibleSets);
        if (!c) return null;
        const highlight = selectedRegion === r.key;
        return (
          <text key={`t-${r.key}`} x={c.x} y={c.y}
            fontSize={12} fill={highlight ? "hsl(var(--primary))" : "#111827"}
            textAnchor="middle" dominantBaseline="central" pointerEvents="none">
            {r.text}
          </text>
        );
      })}

      {/* invisible region hit-catchers behind circles — click through picks the region */}
      {editable && (
        <rect x={0} y={0} width={model.width} height={model.height}
          fill="transparent"
          onPointerDown={(e) => {
            const p = clientToSvg(e.clientX, e.clientY);
            const key = regionKeyAt(p.x, p.y, visibleSets);
            if (key === "") { onSelectRegion(null); onSelectSet(null); return; }
            onSelectRegion(key);
            onSelectSet(null);
          }}
          style={{ pointerEvents: "none" }} />
      )}
    </svg>
  );
}

function RegionShade({ region, sets }: { region: RegionOverride; sets: VennSet[] }) {
  if (region.fill === "none" || !region.fill) return null;
  const inside = new Set(region.key.split(""));
  if (inside.size === 0) return null;

  // Approximate the region as the intersection of "inside" discs minus "outside" discs
  // via SVG clipPath. Build a clip that intersects the inside circles.
  const clipId = `venn-clip-${region.key}-${Math.random().toString(36).slice(2, 6)}`;
  const insideSets = sets.filter((s) => inside.has(s.id));
  const outsideSets = sets.filter((s) => !inside.has(s.id));

  if (insideSets.length === 0) return null;
  const first = insideSets[0];
  const rest = insideSets.slice(1);

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          {insideSets.map((s, i) => (
            <circle key={i} cx={s.cx} cy={s.cy} r={s.radius} />
          ))}
        </clipPath>
      </defs>
      {/* fill the first disc, clipped by all others, then mask out any 'outside' discs */}
      <g clipPath={`url(#${clipId})`}>
        <circle cx={first.cx} cy={first.cy} r={first.radius}
          fill={region.fill} fillOpacity={region.fillOpacity} />
        {/* re-intersect: draw again clipped by remaining insides */}
        {rest.map((s, i) => (
          <circle key={i} cx={s.cx} cy={s.cy} r={s.radius}
            fill={region.fill} fillOpacity={region.fillOpacity} />
        ))}
        {/* subtract outside discs with background-coloured circles */}
        {outsideSets.map((s, i) => (
          <circle key={`o${i}`} cx={s.cx} cy={s.cy} r={s.radius}
            fill="hsl(var(--background))" />
        ))}
      </g>
    </g>
  );
}

function Handle({ x, y, onDown, title }: { x: number; y: number; onDown: (e: React.PointerEvent) => void; title?: string }) {
  return (
    <circle cx={x} cy={y} r={6}
      fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth={2}
      onPointerDown={onDown}
      style={{ cursor: "grab" }}>
      {title ? <title>{title}</title> : null}
    </circle>
  );
}
