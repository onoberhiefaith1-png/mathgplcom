import { useEffect, useRef } from "react";
import { useSmartBoard } from "@/hooks/useSmartBoard";
import { MathRender } from "@/components/mathboard/MathRender";
import { StatusDot } from "./StatusDot";
import { Container, Cursor } from "@/lib/mathboard/cursor";

export const Board = () => {
  const { question, lines, cursorIndex, cursorContainer, workspaceZoom, setWorkspaceZoom, activeLineRef } = useSmartBoard();
  const endRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines.length]);

  // Pinch / Ctrl+wheel zoom on the canvas.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const next = Math.max(0.5, Math.min(2, workspaceZoom + (e.deltaY < 0 ? 0.05 : -0.05)));
      setWorkspaceZoom(Number(next.toFixed(2)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [workspaceZoom, setWorkspaceZoom]);

  const activeLineId = lines[lines.length - 1]?.id;
  const cursor: Cursor = {
    container: cursorContainer
      ? { ...cursorContainer, sessionId: activeLineId }
      : { sessionId: activeLineId, nodeId: null, slot: null },
    index: cursorIndex,
    activeTokenId: null,
  };
  const noop = (_c: Container, _i: number) => { /* read-only */ };

  return (
    <div
      ref={scrollerRef}
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
      style={{ color: "var(--sb-fg)" }}
    >
      <div
        style={{
          transform: `scale(${workspaceZoom})`,
          transformOrigin: "top left",
          width: `${100 / workspaceZoom}%`,
        }}
      >
        {/* Sticky question */}
        <div
          className="sticky top-0 z-10 px-8 md:px-16 pt-5 pb-2 backdrop-blur-md"
          style={{ background: "color-mix(in oklab, var(--sb-bg) 82%, transparent)" }}
        >
          <div
            className="text-[11px] uppercase tracking-[0.18em] mb-1"
            style={{ color: "var(--sb-accent)", opacity: 0.85 }}
          >
            Solve for x
          </div>
          <div style={{ fontSize: "calc(var(--sb-eq-size) * 1.05)" }}>
            <MathRender
              sessionId={`q-${question.id}`}
              nodes={question.nodes}
              cursor={null}
              onFocus={noop}
              readOnly
            />
          </div>
        </div>

        {/* Solving rows — generous classroom-board spacing; rows expand for fractions/surds/powers. */}
        <div className="px-8 md:px-16 pt-4 pb-40 space-y-3">
          {lines.map((ln, i) => {
            const isActive = i === lines.length - 1;
            // Heuristic row height — gives fractions / surds / powers real breathing room.
            // We can't easily inspect Node[] from here, so we sample via ascii flatten via nodesToAscii.
            // Falls back to base when no structure detected.
            const asciiHint = (() => {
              try {
                // Lightweight: look at kinds of nodes in this line.
                const kinds = ln.nodes.map((n: any) => n.kind);
                if (kinds.includes("matrix")) return 84;
                const fracs = kinds.filter((k: string) => k === "frac").length;
                const roots = kinds.filter((k: string) => k === "root").length;
                const pows = kinds.filter((k: string) => k === "power").length;
                if (fracs >= 2) return 76;
                if (fracs === 1 && roots >= 1) return 72;
                if (fracs === 1) return 62;
                if (roots >= 1) return 54;
                if (pows >= 1) return 46;
                return 40;
              } catch {
                return 40;
              }
            })();
            return (
              <div
                key={ln.id}
                ref={isActive ? activeLineRef : undefined}
                className="flex items-center gap-3 group"
                style={{ fontSize: "var(--sb-eq-size)", lineHeight: 1.35, minHeight: `${asciiHint}px` }}
              >
                {/* Quiet leading dot for committed lines so the workspace scans cleanly. */}
                {!isActive && (
                  <div className="w-3 flex-none">
                    <StatusDot status={ln.status} />
                  </div>
                )}
                <div className="flex-1 min-w-0 whitespace-nowrap flex items-center">
                  <MathRender
                    sessionId={ln.id}
                    nodes={ln.nodes}
                    cursor={isActive ? cursor : null}
                    onFocus={noop}
                    readOnly={!isActive}
                  />
                  {/* Active-line dot sits inline at the end of the equation
                      so it follows the cursor into immediate eye focus. */}
                  {isActive && (
                    <span className="ml-3 inline-flex items-center" aria-hidden>
                      <StatusDot status={ln.status} />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  );
};

export default Board;
