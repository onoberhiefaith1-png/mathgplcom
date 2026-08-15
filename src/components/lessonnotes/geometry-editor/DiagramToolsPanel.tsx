// DiagramToolsPanel — the right-hand "Diagram Tools" block.
// Structure-aware annotation: Add Text, Add Angle, Add Area. These attach
// to existing geometry (points, lines, enclosed boundaries) rather than
// floating freely like the left-hand Geometry panel.

import { Type, Triangle, Paintbrush } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGeometryMode } from "./GeometryModeContext";

const TOOLS = [
  {
    id: "smartText" as const,
    label: "Add Text",
    Icon: Type,
    hint: "Click a point for an anchored label, or a line for a midpoint label that rotates with it.",
  },
  {
    id: "smartAngle" as const,
    label: "Add Angle",
    Icon: Triangle,
    hint: "Type the value, then click the two intersecting lines.",
  },
  {
    id: "smartArea" as const,
    label: "Add Area",
    Icon: Paintbrush,
    hint: "Click boundary points; close on the first point to fill the region.",
  },
];

export function DiagramToolsPanel() {
  const { tool, setTool, annotationDraft, setAnnotationDraft } = useGeometryMode();
  const active = TOOLS.find((t) => t.id === tool) ?? null;
  const needsValue =
    annotationDraft?.tool === "smartAngle" && !annotationDraft.confirmed;

  return (
    <div className="space-y-2 rounded border border-foreground/10 p-2">
      <p className="text-[10px] uppercase tracking-wider text-foreground/55">
        Diagram Tools
      </p>

      <div className="grid grid-cols-3 gap-1">
        {TOOLS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTool(tool === id ? "select" : id)}
            className={cn(
              "flex flex-col items-center gap-1 rounded border px-1 py-1.5 text-[10.5px]",
              tool === id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-foreground/20 bg-background hover:bg-muted",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {needsValue && annotationDraft && (
        <div className="space-y-1 rounded border border-primary/40 bg-primary/5 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
            Angle value
          </p>
          <div className="flex gap-1">
            <input
              autoFocus
              value={annotationDraft.value}
              onChange={(e) => setAnnotationDraft({ ...annotationDraft, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && annotationDraft.value.trim()) {
                  setAnnotationDraft({ ...annotationDraft, confirmed: true });
                }
              }}
              placeholder="30, 90, x + 40 …"
              className="flex-1 rounded border border-foreground/20 bg-white px-1.5 py-1 text-black outline-hidden focus:border-primary"
            />
            <button
              type="button"
              disabled={!annotationDraft.value.trim()}
              onClick={() => setAnnotationDraft({ ...annotationDraft, confirmed: true })}
              className="rounded border border-primary bg-primary px-2 py-1 text-[11px] text-primary-foreground disabled:opacity-40"
            >
              Enter
            </button>
          </div>
        </div>
      )}

      {active && (
        <p className="rounded bg-primary/10 px-2 py-1.5 text-[10.5px] leading-snug text-primary">
          {active.hint}
        </p>
      )}

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setTool(tool === "erase" ? "select" : "erase")}
          className={cn(
            "flex-1 rounded border px-2 py-1 text-[11px]",
            tool === "erase"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-foreground/20 bg-background hover:bg-muted",
          )}
        >
          Erase
        </button>
        <button
          type="button"
          onClick={() => setTool("select")}
          className="flex-1 rounded border border-foreground/20 bg-background px-2 py-1 text-[11px] hover:bg-muted"
        >
          Select
        </button>
      </div>
      {tool === "erase" && (
        <p className="rounded bg-destructive/10 px-2 py-1.5 text-[10.5px] leading-snug text-destructive">
          Click a single line, arc or label to remove just that piece. Shared
          points and neighbouring lines stay.
        </p>
      )}
    </div>
  );
}

export default DiagramToolsPanel;
