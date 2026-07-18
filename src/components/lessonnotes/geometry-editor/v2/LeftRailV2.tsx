// LeftRailV2 — the five construction tools plus a Select cursor. This is
// the ONLY toolbar that ever appears on the left. Editing options live on
// the right-hand Properties Panel, never here.

import { MousePointer2, Circle as CircleIcon, CircleDot, Minus, Spline, Waves } from "lucide-react";

export type V2Tool = "select" | "point" | "line" | "circle" | "arc" | "curve";

interface Props {
  tool: V2Tool;
  onChange: (t: V2Tool) => void;
  /** Which tools are enabled in this phase. */
  enabled: Partial<Record<V2Tool, boolean>>;
}

const TOOLS: { id: V2Tool; label: string; hint: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "select", label: "Select", hint: "Select and drag objects", Icon: MousePointer2 },
  { id: "point",  label: "Point",  hint: "Click to place a point",  Icon: CircleDot },
  { id: "line",   label: "Line",   hint: "Click two points to connect", Icon: Minus },
  { id: "circle", label: "Circle", hint: "Click centre, then a radius point", Icon: CircleIcon },
  { id: "arc",    label: "Arc",    hint: "Click start, centre, end", Icon: Spline },
  { id: "curve",  label: "Curve",  hint: "Click points; double-click to finish", Icon: Waves },
];

export function LeftRailV2({ tool, onChange, enabled }: Props) {
  return (
    <div
      className="flex flex-col gap-1 rounded-md border border-foreground/15 bg-background/95 p-1 shadow-sm"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {TOOLS.map(({ id, label, hint, Icon }) => {
        const on = tool === id;
        const disabled = !enabled[id];
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(id)}
            title={disabled ? `${label} — coming soon` : hint}
            aria-label={label}
            aria-pressed={on}
            className={[
              "flex h-9 w-9 items-center justify-center rounded transition-colors",
              on ? "bg-foreground text-background"
                 : "text-foreground/80 hover:bg-foreground/10",
              disabled ? "opacity-30 cursor-not-allowed hover:bg-transparent" : "",
            ].join(" ")}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
