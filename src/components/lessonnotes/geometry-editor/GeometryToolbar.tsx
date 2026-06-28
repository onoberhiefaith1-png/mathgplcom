// GeometryToolbar — vertical strip of geometry tools. The teacher can
// expand the rail to see labels grouped by category, or fold it back to
// compact icons. The choice is persisted in localStorage.

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { TOOLS, TOOL_GROUPS, type ToolId } from "@/lib/geometry/editor/tools";
import {
  MousePointer2, Dot, Minus, CircleDot, Circle, Pentagon, Triangle,
  Type, Ruler, Equal, Slash, Square, Move, Eraser, Lock, RotateCw,
  Pencil, Tag, RadioTower, ChevronsLeft, ChevronsRight,
} from "lucide-react";

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

const STORAGE_KEY = "geometry-editor:toolbar-expanded";

interface Props {
  tool: ToolId;
  onTool: (t: ToolId) => void;
}

export function GeometryToolbar({ tool, onTool }: Props) {
  const [expanded, setExpanded] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, expanded ? "1" : "0"); } catch { /* noop */ }
  }, [expanded]);

  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 p-1.5 border-r border-foreground/10 bg-muted/30 overflow-y-auto transition-[width]",
        expanded ? "w-[176px]" : "w-[40px]",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center justify-center h-7 rounded text-foreground/60 hover:bg-foreground/10 mb-1"
        title={expanded ? "Collapse toolbar" : "Show tool names"}
        aria-label={expanded ? "Collapse toolbar" : "Show tool names"}
      >
        {expanded ? <ChevronsLeft className="h-3.5 w-3.5" /> : <ChevronsRight className="h-3.5 w-3.5" />}
      </button>

      {TOOL_GROUPS.map((g) => {
        const items = TOOLS.filter((t) => t.group === g.id);
        if (!items.length) return null;
        return (
          <div key={g.id} className="flex flex-col gap-0.5">
            {expanded && (
              <div className="px-1 pt-1.5 text-[9px] uppercase tracking-wider text-foreground/40">
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
                  onClick={() => onTool(t.id)}
                  title={`${t.label}${t.shortcut ? ` (${t.shortcut})` : ""} — ${t.hint}`}
                  className={cn(
                    "inline-flex items-center gap-2 rounded text-foreground/70 hover:bg-foreground/10 transition text-left",
                    expanded ? "h-7 px-1.5" : "h-8 w-8 justify-center",
                    active && "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                  aria-label={t.label}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {expanded && <span className="text-[11px] truncate">{t.label}</span>}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
