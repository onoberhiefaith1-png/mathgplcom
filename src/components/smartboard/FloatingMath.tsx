// Floating Mathematics System — minimal, draggable, semi-transparent.
// Two rows: fillers (digits / expressions / named functions) + containers
// (empty structural shells). Pre-fed from the current beat's plan.

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, GripVertical, Maximize2, Minimize2, X } from "lucide-react";
import type { FloatingPlan, ContainerKind } from "@/lib/smartboard/floatingPlan";
import { extractTermsFromAscii, renderTermLabel, STRUCTURE_GLYPH } from "@/lib/smartboard/floatingExtractor";
import { toUnicodeMath, isStillDirty } from "@/lib/notebook/unicodeMath";

interface Props {
  plan: FloatingPlan;
  visible: boolean;
  onInsert?: (token: string) => void;
  onContainer?: (kind: ContainerKind) => void;
}

const VISIBLE = 5;

const CONTAINER_GLYPH = STRUCTURE_GLYPH;

export const FloatingMath = ({ plan, visible, onInsert, onContainer }: Props) => {
  const [pos, setPos] = useState({ x: window.innerWidth - 460, y: window.innerHeight - 240 });
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [fillerOffset, setFillerOffset] = useState(0);
  const [containerOffset, setContainerOffset] = useState(0);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Reset hidden flag whenever a new beat appears
  useEffect(() => { setHidden(false); }, [plan]);

  if (!visible || hidden) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setPos({
      x: Math.max(8, dragRef.current.origX + e.clientX - dragRef.current.startX),
      y: Math.max(8, dragRef.current.origY + e.clientY - dragRef.current.startY),
    });
  };
  const onPointerUp = () => { dragRef.current = null; };

  const fillers = plan.fillers;
  const containers = plan.containers;

  const sliceCycle = <T,>(arr: T[], offset: number): T[] => {
    if (arr.length === 0) return [];
    const n = Math.min(VISIBLE, arr.length);
    const out: T[] = [];
    for (let i = 0; i < n; i++) {
      const idx = (((offset + i) % arr.length) + arr.length) % arr.length;
      out.push(arr[idx]);
    }
    return out;
  };

  const visibleFillers = sliceCycle(fillers, fillerOffset);
  const visibleContainers = sliceCycle(containers, containerOffset);

  return (
    <div
      className="fixed z-30 select-none"
      style={{ left: pos.x, top: pos.y, width: collapsed ? "auto" : 440 }}
    >
      <div
        className="rounded-2xl backdrop-blur-xl px-2 py-2"
        style={{
          background: "color-mix(in oklab, var(--sb-bg, #1a1a1a) 55%, transparent)",
          border: "1px solid color-mix(in oklab, var(--sb-fg, #fff) 14%, transparent)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
          color: "var(--sb-fg, #fff)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-1 pb-1">
          <div
            className="flex items-center gap-1 cursor-grab active:cursor-grabbing text-[10px] uppercase tracking-[0.18em] opacity-60"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <GripVertical className="h-3 w-3" /> Floating Math
          </div>
          <div className="flex items-center gap-0.5">
            <button
              className="h-6 w-6 grid place-items-center rounded hover:bg-white/10"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "expand" : "collapse"}
            >
              {collapsed ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
            </button>
            <button
              className="h-6 w-6 grid place-items-center rounded hover:bg-white/10"
              onClick={() => setHidden(true)}
              aria-label="close"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>

        {!collapsed && (
          <>
            {/* Row 1 — Fillers */}
            <Row
              leftLabel="="
              onLeftTap={() => onInsert?.("=")}
              onPrev={() => setFillerOffset((o) => o - 1)}
              onNext={() => setFillerOffset((o) => o + 1)}
              items={visibleFillers.map((tok, i) => {
                // Stored fillers already encode the correct sign per the
                // source equation (dropContextualLeadingPlus at compile
                // time). Render verbatim — never re-strip by position.
                const cleaned = toUnicodeMath(tok);
                if (!cleaned || isStillDirty(cleaned)) return null;
                const term = extractTermsFromAscii(cleaned)[0];
                const label = term
                  ? renderTermLabel(term, { isFirst: false, prevWasEquals: false })
                  : cleaned;
                return (
                  <Chip key={`f-${i}-${tok}`} onClick={() => onInsert?.(cleaned)}>{label}</Chip>
                );
              })}
              empty={fillers.length === 0}
            />
            {/* Row 2 — Containers */}
            <Row
              leftLabel="□"
              onLeftTap={() => {}}
              onPrev={() => setContainerOffset((o) => o - 1)}
              onNext={() => setContainerOffset((o) => o + 1)}
              items={visibleContainers.map((c, i) => (
                <Chip key={`c-${i}-${c}`} onClick={() => onContainer?.(c)}>{CONTAINER_GLYPH[c as keyof typeof CONTAINER_GLYPH]}</Chip>
              ))}
              empty={containers.length === 0}
            />
          </>
        )}
      </div>
    </div>
  );
};

const Row = ({ leftLabel, onLeftTap, onPrev, onNext, items, empty }: {
  leftLabel: string; onLeftTap: () => void;
  onPrev: () => void; onNext: () => void;
  items: React.ReactNode[]; empty: boolean;
}) => (
  <div className="flex items-center gap-1 px-1 py-1">
    <button
      onClick={onLeftTap}
      className="px-2 py-1 rounded-full text-sm font-semibold"
      style={{
        background: "color-mix(in oklab, var(--sb-fg, #fff) 14%, transparent)",
        border: "1px solid color-mix(in oklab, var(--sb-fg, #fff) 20%, transparent)",
      }}
    >{leftLabel}</button>
    <NavBtn onClick={onPrev}><ChevronLeft className="h-4 w-4" /></NavBtn>
    <div className="flex-1 flex items-center justify-center gap-1 min-h-[34px]">
      {empty ? <span className="text-xs opacity-40">—</span> : items}
    </div>
    <NavBtn onClick={onNext}><ChevronRight className="h-4 w-4" /></NavBtn>
  </div>
);

const NavBtn = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className="h-7 w-7 grid place-items-center rounded-full hover:bg-white/10"
    style={{ color: "color-mix(in oklab, var(--sb-fg, #fff) 70%, transparent)" }}
  >{children}</button>
);

const Chip = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className="px-2.5 py-1 rounded-full text-sm whitespace-nowrap hover:scale-[1.05] active:scale-95 transition-transform"
    style={{
      background: "color-mix(in oklab, var(--sb-fg, #fff) 6%, transparent)",
      border: "1px solid color-mix(in oklab, var(--sb-fg, #fff) 12%, transparent)",
      color: "var(--sb-fg, #fff)",
    }}
  >{children}</button>
);

export default FloatingMath;
