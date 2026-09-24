// SVG renderer + interaction for the Universal Venn Engine.

import { useEffect, useMemo, useRef, useState } from "react";
import type { UCEVennModel, VennSet, RegionOverride } from "./types";
import { solveLayout } from "./solver";
import { regionKeyAt } from "./regions";
import { layoutWriteUp, VALUE_FONT, NOTE_FONT } from "./placement";
import { setRegionText, writeValue, generateExpressions, expressionRegions, expressionRowById, displayLabel } from "./expressions";
import { VennRegionShape } from "./regionRendering";

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
  const lay = useMemo(() => layoutWriteUp(model, solved), [model, solved]);
  const W = lay.width, H = lay.height;
  const focusRow = expressionRowById(model, model.focusExpression);
  const focusRegions = focusRow ? expressionRegions(focusRow, model) : [];
  const focusMode = Boolean(focusRow);
  const diagramHeight = Math.min(H, lay.notesTop || H);
  const focusLabel = focusRow ? displayLabel(focusRow, model) : "";

  const editValue = (key: string) => {
    if (!editable || typeof window === "undefined") return;
    const cur = model.regions.find((r) => r.key === key)?.text ?? "";
    const next = window.prompt("Value for this region", cur);
    if (next !== null) onChange(setRegionText(model, key, next));
  };
  const editNote = (id: string) => {
    if (!editable || typeof window === "undefined") return;
    const row = generateExpressions(model).find((r) => r.id === id);
    if (!row) return editValue(id);
    const cur = row.physical ? model.regions.find((r) => r.key === id)?.text ?? "" : model.expressions?.[id] ?? "";
    const next = window.prompt("Value", cur);
    if (next !== null) onChange(writeValue(model, row, next));
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      onPointerDown={(e) => {
        if (!editable) return;
        if (e.target === svgRef.current) {
          onSelectSet(null);
          onSelectRegion(null);
          return;
        }
      }}
      style={{ display: "block", touchAction: "none", userSelect: "none", overflow: "visible" }}
      role="img"
      aria-label={focusMode ? `Venn diagram focusing ${focusLabel}${focusRegions.length ? "" : ", no common region"}` : "Venn diagram showing all sets"}
      data-venn-mode={focusMode ? "focus" : "overview"}
      data-focus-expression={focusRow?.id ?? undefined}
    >
      <defs>
        <filter id="venn-focus-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {u.show && (
        <rect x={u.padding / 2} y={u.padding / 2}
          width={W - u.padding} height={H - u.padding}
          stroke={u.borderColour} strokeWidth={u.border}
          fill={u.background === "none" ? "none" : u.background}
          fillOpacity={u.background === "none" ? 0 : u.backgroundOpacity}
          pointerEvents="none" />
      )}

      {focusMode ? (
        <g aria-hidden="true">
          <rect x={0} y={0} width={W} height={diagramHeight} fill="hsl(var(--venn-neutral-region))" fillOpacity={0.96} pointerEvents="none" />
          {focusRegions.map((key) => (
            <VennRegionShape
              key={`focus-${key || "outside"}`}
              regionKey={key}
              sets={visibleSets}
              width={W}
              height={diagramHeight}
              fill="hsl(var(--venn-focus))"
              fillOpacity={0.64}
              className="venn-focus-region"
              emphasized
            />
          ))}
        </g>
      ) : model.regions.map((region) => (
        region.fill !== "none" && region.fill ? (
          <VennRegionShape
            key={region.key || "outside"}
            regionKey={region.key}
            sets={visibleSets}
            width={W}
            height={diagramHeight}
            fill={region.fill}
            fillOpacity={region.fillOpacity}
          />
        ) : null
      ))}

      {/* circles */}
      {visibleSets.map((s) => {
        const isSel = selectedSet === s.id;
        return (
          <g key={s.id}>
            <circle cx={s.cx} cy={s.cy} r={s.radius}
              fill={focusMode || s.fill === "none" ? "none" : s.fill}
              fillOpacity={focusMode || s.fill === "none" ? 0 : s.fillOpacity}
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

      {/* write-up values — placed for readability, editable by double-click */}
      {lay.values.map((v) => (
        <text key={`t-${v.key}`} x={v.x} y={v.y}
          fontSize={VALUE_FONT} fontWeight={600}
          fill={selectedRegion === v.key ? "hsl(var(--primary))" : "#111827"}
          stroke="#ffffff" strokeWidth={3} paintOrder="stroke"
          textAnchor="middle" dominantBaseline="central"
          onDoubleClick={(e) => { e.stopPropagation(); editValue(v.key); }}
          style={{ cursor: editable ? "text" : "default" }}>
          {v.text}
        </text>
      ))}
      {lay.outside && (
        <text x={lay.outside.x} y={lay.outside.y} fontSize={VALUE_FONT} fontWeight={600} fill="#111827"
          textAnchor="end" dominantBaseline="central"
          onDoubleClick={(e) => { e.stopPropagation(); editValue(""); }}
          style={{ cursor: editable ? "text" : "default" }}>
          {lay.outside.text}
        </text>
      )}
      {lay.universe && (
        <text x={lay.universe.x} y={lay.universe.y} fontSize={VALUE_FONT} fontWeight={700} fill="#111827"
          onDoubleClick={(e) => { e.stopPropagation(); editNote("universe"); }}
          style={{ cursor: editable ? "text" : "default" }}>
          {lay.universe.text}
        </text>
      )}
      {lay.notes.map((n, i) => (
        <text key={`n-${n.id}`} x={12} y={lay.notesTop + 12 + i * 18} fontSize={NOTE_FONT} fill="#111827"
          onDoubleClick={(e) => { e.stopPropagation(); editNote(n.id); }}
          style={{ cursor: editable ? "text" : "default" }}>
          {n.text}
        </text>
      ))}
      {focusMode && focusRegions.length === 0 && (
        <text x={W / 2} y={diagramHeight - 10} fontSize={NOTE_FONT} fontWeight={700}
          fill="hsl(var(--venn-focus-edge))" textAnchor="middle" aria-live="polite">
          ∅ — No common region
        </text>
      )}

      {/* invisible region hit-catchers behind circles — click through picks the region */}
      {editable && (
        <rect x={0} y={0} width={W} height={H}
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
