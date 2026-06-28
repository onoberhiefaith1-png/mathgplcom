// GeometryToolbar — vertical strip of geometry tools.

import { cn } from "@/lib/utils";
import { TOOLS, type ToolId } from "@/lib/geometry/editor/tools";
import {
  MousePointer2, Dot, Minus, CircleDot, Circle, Pentagon, Triangle,
  Type, Ruler, Equal, Slash, Square, Move, Eraser, Lock, RotateCw,
  Pencil, Tag, RadioTower,
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

interface Props {
  tool: ToolId;
  onTool: (t: ToolId) => void;
  onLabel?: () => void;
  // hint mapping is supplied by TOOLS metadata
}

export function GeometryToolbar({ tool, onTool }: Props) {
  return (
    <div className="flex flex-col gap-0.5 p-1.5 border-r border-foreground/10 bg-muted/30 overflow-y-auto">
      {TOOLS.map((t) => {
        const Icon = ICONS[t.id] ?? Type;
        const active = tool === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onTool(t.id)}
            title={`${t.label}${t.shortcut ? ` (${t.shortcut})` : ""} — ${t.hint}`}
            className={cn(
              "inline-flex items-center justify-center h-8 w-8 rounded text-foreground/70 hover:bg-foreground/10 transition",
              active && "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
            aria-label={t.label}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
