// DiagramToolsPanel — the right-hand "Diagram Tools" block.
// Plain by default: Add Text | Add Angle | Add Area, plus Erase / Select.
// Each tool runs a short temporary workflow (enter value → pick) that ends
// itself; while a workflow runs, only that step is shown. When an object is
// selected the grid collapses to a compact row so its properties own the
// panel.

import { Type, Triangle, Paintbrush, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGeometryMode } from "./GeometryModeContext";

const TOOLS = [
  { id: "smartText" as const, label: "Add Text", Icon: Type },
  { id: "smartAngle" as const, label: "Add Angle", Icon: Triangle },
  { id: "smartArea" as const, label: "Add Area", Icon: Paintbrush },
];

interface Props {
  /** True when exactly one (or more) diagram objects are selected. */
  hasSelection?: boolean;
  /** How many objects the running workflow has picked so far. */
  pickCount?: number;
}

export function DiagramToolsPanel({ hasSelection = false, pickCount = 0 }: Props) {
  const { tool, setTool, annotationDraft, setAnnotationDraft } = useGeometryMode();

  const running =
    annotationDraft && (annotationDraft.tool === "smartText"
      || annotationDraft.tool === "smartAngle"
      || annotationDraft.tool === "smartArea")
      ? annotationDraft
      : null;

  // Text / Angle need a value first; typing one arms the pick step straight
  // away — no Enter, no submit button.
  const needsValue = !!running && running.tool !== "smartArea";
  const armed = !!running && (running.tool === "smartArea" || !!running.value.trim());
  const cancel = () => setTool("select");

  const pickHint =
    running?.tool === "smartText" ? "Select line"
    : running?.tool === "smartAngle" ? "Select line at the intersection"
    : "Select the lines that enclose the region";


  if (running) {
    return (
      <div className="space-y-2 rounded border border-primary/40 bg-primary/5 p-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
            {running.tool === "smartText" ? "Add Text"
              : running.tool === "smartAngle" ? "Add Angle" : "Add Area"}
          </p>
          <button
            type="button"
            onClick={cancel}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-foreground/70 hover:bg-muted"
          >
            <X className="h-3 w-3" /> Cancel
          </button>
        </div>

        {needsValue && (
          <div className="space-y-1">
            <p className="text-[10.5px] leading-snug text-foreground/70">
              {running.tool === "smartText"
                ? "Type the text or measurement, then select the line."
                : "Type the angle value, then select the line."}
            </p>
            <input
              autoFocus
              value={running.value}
              onChange={(e) => setAnnotationDraft({
                ...running,
                value: e.target.value,
                notice: undefined,
                step: e.target.value.trim() ? "pick" : "value",
              })}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              placeholder={running.tool === "smartAngle" ? "30, 90, x + 40 …" : "47 cm, ASB …"}
              className="w-full rounded border border-foreground/20 bg-white px-1.5 py-1 text-black outline-hidden focus:border-primary"
            />
          </div>
        )}

        <p className={cn(
          "text-[10.5px] leading-snug",
          armed ? "font-medium text-primary" : "text-foreground/50",
        )}>
          {armed ? pickHint : "Enter a value to continue"}
          {running.tool === "smartArea" && pickCount > 0 ? ` · ${pickCount} picked` : ""}
        </p>


        {running.notice && (
          <p className="rounded bg-destructive/10 px-2 py-1 text-[10.5px] leading-snug text-destructive">
            {running.notice}
          </p>
        )}
      </div>
    );
  }

  if (hasSelection) {
    // Properties own the panel; keep a single compact "Add…" row.
    return (
      <div className="flex items-center gap-1 rounded border border-foreground/10 p-1.5">
        <span className="pl-0.5 pr-1 text-[10px] uppercase tracking-wider text-foreground/50">Add</span>
        {TOOLS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTool(id)}
            title={label}
            className="flex flex-1 items-center justify-center gap-1 rounded border border-foreground/20 bg-background px-1 py-1 text-[10.5px] hover:bg-muted"
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="leading-tight">{label.replace("Add ", "")}</span>
          </button>
        ))}
      </div>
    );
  }

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
            onClick={() => setTool(id)}
            className="flex flex-col items-center gap-1 rounded border border-foreground/20 bg-background px-1 py-1.5 text-[10.5px] hover:bg-muted"
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="leading-tight">{label}</span>
          </button>
        ))}
      </div>

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
          className={cn(
            "flex-1 rounded border px-2 py-1 text-[11px]",
            tool === "select"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-foreground/20 bg-background hover:bg-muted",
          )}
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
