// PointPanel — the right-hand editor for a selected Point in the v2
// Geometry Editor. Rendered inside the universal PropertiesPanel via
// useRegisterAssetEditor. Only the minimum settings live here:
//   - Rename label
//   - Point colour
//   - Hide point (hides dot + label without deleting geometry)

import type { V2Point } from "@/lib/geometry/v2/scene";
import { Eye, EyeOff, Trash2 } from "lucide-react";

interface Props {
  point: V2Point;
  onPatch: (patch: Partial<V2Point>) => void;
  onDelete: () => void;
}

const SWATCHES = ["#1f1f24", "#e11d48", "#2563eb", "#059669", "#d97706", "#7c3aed"];

export function PointPanel({ point, onPatch, onDelete }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <section>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
          Rename Label
        </div>
        <input
          value={point.labelText}
          onChange={(e) => onPatch({ labelText: e.target.value })}
          className="h-9 w-full rounded border border-foreground/20 bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/30"
          placeholder="e.g. A"
          maxLength={16}
        />
      </section>

      <section>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
          Point Colour
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onPatch({ color: c })}
              className={[
                "h-7 w-7 rounded-full border-2 transition-transform",
                point.color === c ? "border-foreground scale-110" : "border-transparent hover:scale-105",
              ].join(" ")}
              style={{ background: c }}
              aria-label={`Colour ${c}`}
              title={c}
            />
          ))}
          <input
            type="color"
            value={point.color}
            onChange={(e) => onPatch({ color: e.target.value })}
            className="h-7 w-9 cursor-pointer rounded border border-foreground/20 bg-background"
            title="Custom colour"
          />
        </div>
      </section>

      <section>
        <button
          type="button"
          onClick={() => onPatch({ hidden: !point.hidden })}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded border border-foreground/20 bg-background text-sm text-foreground hover:bg-foreground/5"
        >
          {point.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          {point.hidden ? "Show Point" : "Hide Point"}
        </button>
        <p className="mt-1 text-[11px] text-foreground/60">
          Hiding removes the dot and label from view. Connected geometry is preserved.
        </p>
      </section>

      <section>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded border border-red-500/30 text-sm text-red-600 hover:bg-red-500/10"
        >
          <Trash2 className="h-4 w-4" />
          Delete Point
        </button>
      </section>
    </div>
  );
}
