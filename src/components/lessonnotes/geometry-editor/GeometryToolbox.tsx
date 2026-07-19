// GeometryToolbox — floating left-side toolbox shown while Geometry Mode
// is active. Exposes the five construction tools (Point, Line, Circle,
// Arc, Curve) plus a Select cursor. Circle is bound to the compass flow
// (centre + radius point). All editing options live on the right-hand
// Properties Panel — never here.

import { useEffect, useState, useRef } from "react";
import {
  MousePointer2, Dot, Minus, Circle, Waves, ChevronLeft, ChevronRight, X,
  Type, Ruler, Triangle, Paintbrush, Check,
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

const GEOMETRY_SLOTS: Slot[] = [
  { id: "select", toolId: "select", label: "Select", hint: "Select and drag objects", Icon: MousePointer2 },
  { id: "point",  toolId: "point",  label: "Point",  hint: "Click to place a point", Icon: Dot },
  { id: "line",   toolId: "line",   label: "Line",   hint: "Click two points to connect them", Icon: Minus },
  // Circle uses the compass flow: click centre, then a radius point.
  { id: "circle", toolId: "compass", label: "Circle", hint: "Click centre, then a radius point", Icon: Circle },
  { id: "arc",    toolId: "arc",    label: "Arc",    hint: "Click start, through, end (in that order)", Icon: ArcIcon },
  { id: "curve",  toolId: "curve",  label: "Curve",  hint: "Click points; double-click to finish", Icon: Waves },
];

const ANNOTATION_SLOTS: Slot[] = [
  { id: "addText",     toolId: "addText",     label: "Add Text",     hint: "Click anywhere to place a text label", Icon: Type },
  { id: "addDistance", toolId: "addDistance", label: "Add Distance", hint: "Click two points to label a distance", Icon: Ruler },
  { id: "addAngle",    toolId: "addAngle",    label: "Add Angle",    hint: "Click arm, vertex, arm to label an angle", Icon: Triangle },
  { id: "addArea",     toolId: "addArea",     label: "Add Area",     hint: "Trace a boundary; click start point or double-click to close", Icon: Paintbrush },
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
  const { mode, setMode, tool, setTool, annotationDraft, setAnnotationDraft } = useGeometryMode();
  const [expanded, setExpanded] = useState<boolean>(() => {
    try { return localStorage.getItem(KEY) !== "0"; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, expanded ? "1" : "0"); } catch { /* noop */ }
  }, [expanded]);

  if (!mode) return null;

  const draftNeedsInput =
    annotationDraft &&
    !annotationDraft.confirmed &&
    (annotationDraft.tool === "addText" ||
      annotationDraft.tool === "addDistance" ||
      annotationDraft.tool === "addAngle");

  return (
    <aside
      className="fixed left-3 top-28 z-30 flex flex-col rounded-lg border border-foreground/15 bg-background/95 backdrop-blur shadow-lg"
      style={{ width: expanded ? 176 : 44, maxHeight: "calc(100vh - 9rem)" }}
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
        {GEOMETRY_SLOTS.map((s) => renderSlot(s, tool, setTool, expanded))}

        {expanded ? (
          <div className="mt-2 px-2 pt-2 pb-1 text-[10px] uppercase tracking-wider text-foreground/45 border-t border-foreground/10">
            Annotation
          </div>
        ) : (
          <div className="mt-2 mx-2 border-t border-foreground/10" />
        )}
        {ANNOTATION_SLOTS.map((s) => renderSlot(s, tool, setTool, expanded))}

        {expanded && draftNeedsInput && (
          <AnnotationDraftInput
            tool={annotationDraft.tool}
            value={annotationDraft.value}
            onChange={(v) => setAnnotationDraft({ ...annotationDraft, value: v })}
            onConfirm={() => setAnnotationDraft({ ...annotationDraft, confirmed: true })}
            onCancel={() => setTool("select")}
          />
        )}
        {expanded && annotationDraft?.confirmed && (
          <div className="mx-2 mt-2 px-2 py-1.5 rounded bg-primary/10 border border-primary/30 text-[10.5px] text-primary leading-snug">
            {hintFor(annotationDraft.tool, annotationDraft.value)}
            <button
              type="button"
              onClick={() => setTool("select")}
              className="ml-1 underline opacity-70 hover:opacity-100"
            >Cancel</button>
          </div>
        )}
      </div>
    </aside>
  );
}

function AnnotationDraftInput({
  tool, value, onChange, onConfirm, onCancel,
}: {
  tool: "addText" | "addDistance" | "addAngle";
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { inputRef.current?.focus(); }, [tool]);
  const label = tool === "addText" ? "Text" : tool === "addDistance" ? "Distance" : "Angle";
  const placeholder = tool === "addText" ? "Type text…"
    : tool === "addDistance" ? "e.g. 5 cm or AB"
    : "e.g. 30° or θ";
  return (
    <div className="mx-2 mt-2 p-2 rounded border border-primary/40 bg-primary/5 space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider text-primary font-semibold">{label}</div>
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); if (value.trim()) onConfirm(); }
            else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
          }}
          placeholder={placeholder}
          className="flex-1 min-w-0 text-[12px] px-1.5 py-1 rounded border border-foreground/25 bg-white text-black outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={() => value.trim() && onConfirm()}
          className="p-1 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
          disabled={!value.trim()}
          title="Confirm"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="text-[10px] text-foreground/55">Enter to confirm · Esc to cancel</div>
    </div>
  );
}

function hintFor(t: "addText" | "addDistance" | "addAngle" | "addArea", value: string): string {
  if (t === "addText") return `Select a point to place “${value}”.`;
  if (t === "addDistance") return `Select the first point (value: ${value}).`;
  if (t === "addAngle") return `Select the first arm (angle: ${value}).`;
  return "Trace the enclosed region by selecting boundary points.";
}

function renderSlot(
  s: Slot,
  tool: ToolId,
  setTool: (t: ToolId) => void,
  expanded: boolean,
) {
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
}

