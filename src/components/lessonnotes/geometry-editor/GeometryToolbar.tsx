// GeometryToolbar — collapsible "Geometry Tools" panel.
// Default state is collapsed (just a header). Expanding it reveals each
// tool with its icon AND name, grouped by category. Inside the expanded
// view, each group can also be collapsed individually. The overall state
// is persisted in localStorage so it survives reloads.

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { TOOLS, TOOL_GROUPS, type ToolId } from "@/lib/geometry/editor/tools";
import {
  MousePointer2, Dot, Minus, CircleDot, Circle, Pentagon, Triangle,
  Type, Ruler, Equal, Slash, Square, Move, Eraser, Lock, RotateCw,
  Pencil, Tag, RadioTower, Waves, ChevronRight, ChevronDown,
} from "lucide-react";

const ICONS: Record<ToolId, React.ComponentType<{ className?: string }>> = {
  select: MousePointer2,
  point: Dot,
  line: Minus,
  arc: RadioTower,
  circle: Circle,
  curve: Waves,
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

const ROOT_KEY = "geometry-editor:toolbar-open";
const GROUP_KEY = "geometry-editor:toolbar-groups";

interface Props {
  tool: ToolId;
  onTool: (t: ToolId) => void;
}

export function GeometryToolbar({ tool, onTool }: Props) {
  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(ROOT_KEY) !== "0"; } catch { return true; }
  });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(GROUP_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* noop */ }
    return Object.fromEntries(TOOL_GROUPS.map((g) => [g.id, true]));
  });

  useEffect(() => {
    try { localStorage.setItem(ROOT_KEY, open ? "1" : "0"); } catch { /* noop */ }
  }, [open]);
  useEffect(() => {
    try { localStorage.setItem(GROUP_KEY, JSON.stringify(openGroups)); } catch { /* noop */ }
  }, [openGroups]);

  const toggleGroup = (id: string) =>
    setOpenGroups((g) => ({ ...g, [id]: !g[id] }));

  return (
    <div className="w-full border-b border-foreground/10 bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-2.5 py-2 text-[12px] font-medium text-foreground/80 hover:bg-foreground/5"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <span>Geometry Tools</span>
        <span className="ml-auto text-[10px] text-foreground/45">
          {open ? "Click to collapse" : "Click to expand"}
        </span>
      </button>

      {open && (
        <div className="px-1 pb-2">
          {TOOL_GROUPS.map((g) => {
            const items = TOOLS.filter((t) => t.group === g.id);
            if (!items.length) return null;
            const gOpen = openGroups[g.id] !== false;
            return (
              <div key={g.id} className="mt-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(g.id)}
                  className="w-full flex items-center gap-1 px-1.5 py-1 text-[10px] uppercase tracking-wider text-foreground/45 hover:text-foreground/70"
                >
                  {gOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {g.label}
                </button>
                {gOpen && (
                  <div className="flex flex-col">
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
                            "flex items-center gap-2 px-2 py-1 rounded text-[12px] text-left transition",
                            active
                              ? "bg-primary text-primary-foreground"
                              : "text-foreground/75 hover:bg-foreground/5",
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{t.label}</span>
                          {t.shortcut && !active && (
                            <span className="ml-auto text-[9px] text-foreground/40">{t.shortcut}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
