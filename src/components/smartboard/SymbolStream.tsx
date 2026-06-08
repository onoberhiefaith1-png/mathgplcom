// FlowBoard — Three-Layer Floating Engine UI.
//
// One fixed container under the active line. Three internal layers
// (RAW · ACTIVE · STRUCTURE) cycle vertically via wheel / touch swipe.
// The container itself never moves. A leading "=" chip is permanently
// anchored on the left across all layers.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { useSmartBoard } from "@/hooks/useSmartBoard";
import { predictLayers, Suggestion } from "@/lib/smartboard/predictor";
import type { StructureId } from "@/lib/smartboard/structures";

interface Props {
  onAction?: (action: "save" | "next" | "retry") => void;
}

const VISIBLE = 7;
type Layer = "raw" | "active" | "structure";

// Cycle order on UPWARD intent  (active → raw → structure → active).
const cycleUp = (l: Layer): Layer =>
  l === "active" ? "raw" : l === "raw" ? "structure" : "active";
// Cycle order on DOWNWARD intent (active → structure → raw → active).
const cycleDown = (l: Layer): Layer =>
  l === "active" ? "structure" : l === "structure" ? "raw" : "active";

export const SymbolStream = ({ onAction }: Props) => {
  const {
    question, lines, isComplete, scatterIdx,
    insertAscii, insertStructure,
    newQuestion, reset, activeLineRef,
  } = useSmartBoard();

  const [offset, setOffset] = useState(0);
  const [layer, setLayer] = useState<Layer>("active");
  const [animDir, setAnimDir] = useState<"up" | "down" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const acceptedLines = useMemo(() => lines.slice(0, -1).map((l) => l.nodes), [lines]);
  const active = lines[lines.length - 1]?.nodes ?? [];

  const layers = useMemo(
    () => predictLayers(question, acceptedLines, active, isComplete, null, scatterIdx),
    [question, acceptedLines, active, isComplete, scatterIdx],
  );

  // Reset offset on question / completion / new line / layer.
  useEffect(() => { setOffset(0); }, [isComplete, lines.length, question.id, layer]);
  // Snap back to ACTIVE on question change.
  useEffect(() => { setLayer("active"); }, [question.id, isComplete]);

  // Anchor under the active line.
  useLayoutEffect(() => {
    const update = () => {
      const el = activeLineRef.current;
      const parent = containerRef.current?.offsetParent as HTMLElement | null;
      if (!el || !parent) return;
      const r = el.getBoundingClientRect();
      const pr = parent.getBoundingClientRect();
      setPos({ top: r.bottom - pr.top + 10, left: 0, width: pr.width });
    };
    update();
    const ro = new ResizeObserver(update);
    if (activeLineRef.current) ro.observe(activeLineRef.current);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const t = window.setInterval(update, 250);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      window.clearInterval(t);
    };
  }, [activeLineRef, lines.length, isComplete]);

  // Brief pulse animation when layer changes.
  useEffect(() => {
    if (!animDir) return;
    const t = window.setTimeout(() => setAnimDir(null), 180);
    return () => window.clearTimeout(t);
  }, [animDir, layer]);

  // Layer-cycling that skips empty layers (structure may be empty for plain linears).
  const layerHas = (l: Layer): boolean =>
    l === "raw" ? layers.raw.length > 0 :
    l === "structure" ? layers.structure.length > 0 :
    layers.active.length > 0;
  const stepLayer = (start: Layer, dir: "up" | "down"): Layer => {
    let next = start;
    for (let i = 0; i < 3; i++) {
      next = dir === "up" ? cycleUp(next) : cycleDown(next);
      if (layerHas(next)) return next;
    }
    return start;
  };
  const goUp = () => { setAnimDir("up"); setLayer((l) => stepLayer(l, "up")); setOffset(0); };
  const goDown = () => { setAnimDir("down"); setLayer((l) => stepLayer(l, "down")); setOffset(0); };

  // ---- Vertical gesture handlers (wheel + touch/pointer) ----
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // Vertical-dominant scroll: cycle layer, prevent page scroll.
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && Math.abs(e.deltaY) > 4) {
        e.preventDefault();
        if (e.deltaY < 0) goUp();
        else              goDown();
      } else if (Math.abs(e.deltaX) > 4) {
        e.preventDefault();
        setOffset((o) => o + (e.deltaX > 0 ? 1 : -1));
      }
    };

    let startY = 0; let startX = 0; let triggered = false;
    const onPointerDown = (e: PointerEvent) => {
      startY = e.clientY; startX = e.clientX; triggered = false;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (triggered || e.buttons === 0) return;
      const dy = e.clientY - startY;
      const dx = e.clientX - startX;
      if (Math.abs(dy) > 24 && Math.abs(dy) > Math.abs(dx)) {
        triggered = true;
        if (dy < 0) goUp();
        else        goDown();
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  const handleTap = (s: Suggestion) => {
    if (s.tokensAscii === "__save")  { onAction?.("save");  return; }
    if (s.tokensAscii === "__next")  { newQuestion();       return; }
    if (s.tokensAscii === "__retry") { reset();             return; }
    if (s.tokensAscii.startsWith("__struct:")) {
      const id = s.tokensAscii.slice("__struct:".length) as StructureId;
      insertStructure(id);
    } else {
      insertAscii(s.tokensAscii);
    }
    setOffset(0);
    setLayer("active"); // snap back to smart layer for the next step
  };

  // ----- Action chips when complete -----
  if (isComplete) {
    return (
      <div
        ref={containerRef}
        className="absolute z-20 pointer-events-none flex justify-center"
        style={{
          top: pos?.top ?? "auto",
          left: pos?.left ?? 0,
          width: pos?.width ?? "100%",
          bottom: pos ? "auto" : 16,
        }}
      >
        <div
          className="pointer-events-auto flex items-center gap-1 rounded-full px-2 py-1 backdrop-blur-md"
          style={{
            background: "color-mix(in oklab, var(--sb-bg) 70%, transparent)",
            border: "1px solid color-mix(in oklab, var(--sb-fg) 10%, transparent)",
          }}
        >
          {layers.actions.map((s) => (
            <button
              key={s.id}
              onClick={() => handleTap(s)}
              className="px-3 py-1 text-base rounded-full hover:scale-[1.04] active:scale-95 transition-transform"
              style={{ color: "var(--sb-fg)", background: "color-mix(in oklab, var(--sb-fg) 7%, transparent)" }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ----- Pick the visible layer's chip list -----
  const stream: Suggestion[] =
    layer === "raw" ? layers.raw :
    layer === "structure" ? layers.structure :
    layers.active;

  const total = stream.length;
  const visible: Suggestion[] = [];
  if (total > 0) {
    const n = Math.min(VISIBLE, total);
    for (let i = 0; i < n; i++) {
      const idx = (((offset + i) % total) + total) % total;
      visible.push(stream[idx]);
    }
  }

  const navBtn = (label: string, onClick: () => void, children: React.ReactNode) => (
    <button
      onClick={onClick}
      aria-label={label}
      className="h-8 w-8 grid place-items-center rounded-full hover:bg-[color-mix(in_oklab,var(--sb-fg)_8%,transparent)]"
      style={{ color: "var(--sb-muted)" }}
    >
      {children}
    </button>
  );

  // Tap on the persistent "=" chip inserts =.
  const onEqTap = () => {
    insertAscii("=");
    setOffset(0);
  };

  // Layer-change animation: chips slide in from opposite vertical direction.
  const slideClass =
    animDir === "up"   ? "animate-[sb-slide-down_180ms_ease-out]" :
    animDir === "down" ? "animate-[sb-slide-up_180ms_ease-out]"   : "";

  return (
    <div
      ref={containerRef}
      className="absolute z-20 pointer-events-none flex justify-center"
      style={{
        top: pos?.top ?? "auto",
        left: pos?.left ?? 0,
        width: pos?.width ?? "100%",
        bottom: pos ? "auto" : 16,
      }}
    >
      {/* Local keyframes for layer transitions (kept inline to avoid touching index.css). */}
      <style>{`
        @keyframes sb-slide-up   { from { transform: translateY(8px);  opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes sb-slide-down { from { transform: translateY(-8px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
      <div
        ref={innerRef}
        className="pointer-events-auto relative flex items-center gap-1 rounded-full px-1.5 py-1 backdrop-blur-md select-none touch-none"
        style={{
          background: "color-mix(in oklab, var(--sb-bg) 72%, transparent)",
          border: "1px solid color-mix(in oklab, var(--sb-fg) 10%, transparent)",
          boxShadow: "0 8px 28px color-mix(in oklab, var(--sb-bg) 60%, transparent)",
        }}
      >
        {/* Persistent "=" anchor chip (left, never rotates). */}
        <button
          onClick={onEqTap}
          aria-label="equals"
          className="px-3 py-1 text-base rounded-full whitespace-nowrap hover:scale-[1.04] active:scale-95 transition-transform"
          style={{
            color: "var(--sb-fg)",
            background: "color-mix(in oklab, var(--sb-fg) 12%, transparent)",
            border: "1px solid color-mix(in oklab, var(--sb-fg) 18%, transparent)",
            fontWeight: 600,
          }}
        >
          =
        </button>

        <span
          className="mx-0.5 h-5 w-px"
          style={{ background: "color-mix(in oklab, var(--sb-fg) 14%, transparent)" }}
        />

        {navBtn("previous", () => setOffset((o) => o - 1), <ChevronLeft className="h-4 w-4" />)}

        <div className={`flex items-center gap-1 px-1 ${slideClass}`} key={layer}>
          {visible.length === 0 && (
            <span className="text-xs px-2 py-1 opacity-50" style={{ color: "var(--sb-muted)" }}>—</span>
          )}
          {visible.map((s, i) => (
            <button
              key={s.id + "-" + i}
              onClick={() => handleTap(s)}
              className="px-3 py-1 text-base rounded-full transition-all whitespace-nowrap hover:scale-[1.04] active:scale-95"
              style={{
                color: "var(--sb-fg)",
                background: "color-mix(in oklab, var(--sb-fg) 5%, transparent)",
                border: "1px solid color-mix(in oklab, var(--sb-fg) 10%, transparent)",
                opacity: s.group === "likely" ? 1 : 0.85,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {navBtn("next", () => setOffset((o) => o + 1), <ChevronRight className="h-4 w-4" />)}

        {/* Vertical layer cyclers — replace the ENTIRE symbolic layer. */}
        <div className="ml-1 flex flex-col items-center justify-center gap-0.5">
          <button
            onClick={goUp}
            aria-label="layer up"
            className="h-4 w-6 grid place-items-center rounded-md hover:bg-[color-mix(in_oklab,var(--sb-fg)_10%,transparent)]"
            style={{ color: "var(--sb-muted)" }}
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            onClick={goDown}
            aria-label="layer down"
            className="h-4 w-6 grid place-items-center rounded-md hover:bg-[color-mix(in_oklab,var(--sb-fg)_10%,transparent)]"
            style={{ color: "var(--sb-muted)" }}
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SymbolStream;
