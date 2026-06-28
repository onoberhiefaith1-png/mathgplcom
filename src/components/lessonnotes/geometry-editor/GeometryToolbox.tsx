// GeometryToolbox — floating left-side toolbox shown while Geometry Mode
// is active. Two display modes (collapsed icons / expanded with labels)
// persisted in localStorage. Picking a tool broadcasts via the Geometry
// Mode context to whichever diagram frame is currently selected.

import { useEffect, useState } from "react";
import {
  MousePointer2, Dot, Minus, CircleDot, Circle, Pentagon, Triangle,
  Type, Ruler, Equal, Slash, Square, Move, Eraser, Lock, RotateCw,
  Pencil, Tag, RadioTower, ChevronLeft, ChevronRight, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TOOLS, TOOL_GROUPS, type ToolId } from "@/lib/geometry/editor/tools";
import { useGeometryMode } from "./GeometryModeContext";

const ICONS: Record<ToolId, React.ComponentType<{ className?: string }>> = {
  select: MousePointer2,
  point: Dot,
  line: Minus,
  arc: RadioTower,
  circle: Circle,
  polygon: Pentagon,
  angle: Triangle,
  label: Tag,
  measure: Ruler,
  equalMark: Equal,
  parallel: Slash,
  perpendicular: Square,
  rightAngle: Square,
  midpoint: CircleDot,
  compass: Circle,
  move: Move,
  erase: Eraser,
  constraint: Lock,
  rotate: RotateCw,
  sketch: Pencil,
};

const KEY = "geometry-toolbox:expanded";

export function GeometryToolbox() {
  const { mode, setMode, tool, setTool } = useGeometryMode();
  const [expanded, setExpanded] = useState<boolean>(() => {
    try { return localStorage.getItem(KEY) !== "0"; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, expanded ? "1" : "0"); } catch { /* noop */ }
  }, [expanded]);

  if (!mode) return null;

  return (
    <aside
      className="fixed left-3 top-28 z-30 flex flex-col rounded-lg border border-foreground/15 bg-background/95 backdrop-blur shadow-lg"
      style={{ width: expanded ? 156 : 44, maxHeight: "calc(100vh - 9rem)" }}
      role="toolbar"
      aria-label="Geometry tools"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 px-1.5 py-1.5 border-b border-foreground/10">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 inline-flex items-center gap-1 px-1 py-0.5 rounded text-[11px] font-medium text-foreground/75 hover:bg-foreground/5"
          title={expanded ? "Collapse to icons" : "Expand with labels"}
        >
          {expanded ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {expanded && <span>Geometry</span>}
        </button>
        <button
          type="button"
          onClick={() => setMode(false)}
          className="p-1 rounded hover:bg-foreground/10 text-foreground/55"
          title="Exit Geometry Mode"
          aria-label="Exit Geometry Mode"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {TOOL_GROUPS.map((g) => {
          const items = TOOLS.filter((t) => t.group === g.id);
          if (!items.length) return null;
          return (
            <div key={g.id} className="mb-1">
              {expanded && (
                <div className="px-2 pt-1 pb-0.5 text-[9px] uppercase tracking-wider text-foreground/40">
                  {g.label}
                </div>
              )}
              {items.map((t) => {
                const Icon = ICONS[t.id] ?? Type;
                const active = tool === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTool(t.id)}
                    title={`${t.label}${t.shortcut ? ` (${t.shortcut})` : ""} — ${t.hint}`}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1 text-[12px] transition",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground/75 hover:bg-foreground/5",
                      expanded ? "justify-start" : "justify-center",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {expanded && <span className="truncate">{t.label}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
