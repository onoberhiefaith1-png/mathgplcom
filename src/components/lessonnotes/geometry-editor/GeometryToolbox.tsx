// GeometryToolbox — floating left-side toolbox shown while Geometry Mode
// is active. Exposes the five construction tools (Point, Line, Circle,
// Arc, Curve) plus a Select cursor. Circle is bound to the compass flow
// (centre + radius point). All editing options live on the right-hand
// Properties Panel — never here.

import { useEffect, useState } from "react";
import {
  MousePointer2, Dot, Minus, Circle, Waves, ChevronLeft, ChevronRight, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolId } from "@/lib/geometry/editor/tools";
import { useGeometryMode } from "./GeometryModeContext";

interface Slot {
  id: string;
  toolId: ToolId;
  label: string;
  hint: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const SLOTS: Slot[] = [
  { id: "select", toolId: "select", label: "Select", hint: "Select and drag objects", Icon: MousePointer2 },
  { id: "point",  toolId: "point",  label: "Point",  hint: "Click to place a point", Icon: Dot },
  { id: "line",   toolId: "line",   label: "Line",   hint: "Click two points to connect them", Icon: Minus },
  // Circle uses the compass flow: click centre, then a radius point.
  { id: "circle", toolId: "compass", label: "Circle", hint: "Click centre, then a radius point", Icon: Circle },
  { id: "arc",    toolId: "arc",    label: "Arc",    hint: "Click start, through, end (in that order)", Icon: ArcIcon },
  { id: "curve",  toolId: "curve",  label: "Curve",  hint: "Click points; double-click to finish", Icon: Waves },
];

function ArcIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 18 A 10 10 0 0 1 20 18" />
      <circle cx="4" cy="18" r="1.4" fill="currentColor" />
      <circle cx="20" cy="18" r="1.4" fill="currentColor" />
    </svg>
  );
}

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
        {SLOTS.map((s) => {
          const active = tool === s.toolId;
          const Icon = s.Icon;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setTool(s.toolId)}
              title={`${s.label} — ${s.hint}`}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 text-[12px] transition",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/80 hover:bg-foreground/5",
                expanded ? "justify-start" : "justify-center",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {expanded && <span className="truncate">{s.label}</span>}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
