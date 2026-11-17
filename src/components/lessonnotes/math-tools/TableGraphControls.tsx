// Shared axis picker and teacher “Add graph” fields for the Smart Table graph.
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LineChart } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  columnHeadingLabel, normalizeGraphScore, type GraphAxes, type GraphScore,
} from "@/lib/lessonnotes/tableGraph";

export function AxisPicker({
  headers,
  xCol,
  yCol,
  onChange,
  showOpen = false,
  onOpen,
  compact = false,
  ink,
}: {
  headers: string[];
  xCol: number | null;
  yCol: number | null;
  onChange: (next: { xCol: number | null; yCol: number | null }) => void;
  showOpen?: boolean;
  onOpen?: () => void;
  compact?: boolean;
  ink?: string;
}) {
  const ready = xCol != null && yCol != null && xCol !== yCol;
  const color = ink ?? undefined;
  return (
    <div
      data-axis-picker
      className={cn(
        "flex w-fit max-w-full flex-col gap-1 rounded-md border border-border bg-background p-2 text-foreground shadow-xs",
        compact && "p-1.5",
      )}
      style={color ? { color } : undefined}
    >
      <div className="text-[11px] font-semibold">Choose axes</div>
      <AxisSelect
        dataAttr="data-axis-x"
        label="X axis"
        headers={headers}
        value={xCol}
        disabledIndex={yCol}
        onChange={(v) => onChange({ xCol: v, yCol })}
      />
      <AxisSelect
        dataAttr="data-axis-y"
        label="Y axis"
        headers={headers}
        value={yCol}
        disabledIndex={xCol}
        onChange={(v) => onChange({ xCol, yCol: v })}
      />
      {showOpen && ready && (
        <button
          type="button"
          data-open-graph
          onClick={onOpen}
          className="mt-1 inline-flex h-8 items-center justify-center gap-1 rounded-md border border-primary bg-primary px-2.5 text-[12px] font-semibold text-primary-foreground"
        >
          <LineChart className="h-3.5 w-3.5" /> Open graph
        </button>
      )}
    </div>
  );
}

function AxisSelect({
  dataAttr, label, headers, value, disabledIndex, onChange,
}: {
  dataAttr: string;
  label: string;
  headers: string[];
  value: number | null;
  disabledIndex: number | null;
  onChange: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const current = value == null ? "Select column" : columnHeadingLabel(headers[value], value);
  return (
    <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">
      {label}
      <div ref={root} className="relative mt-0.5">
        <button
          type="button"
          {...{ [dataAttr]: "" }}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={label}
          onClick={() => setOpen((v) => !v)}
          className="flex h-8 w-full min-w-[10rem] items-center justify-between gap-1 rounded border border-border bg-background px-2 text-left text-xs font-medium normal-case text-foreground"
        >
          <span className="truncate">{current}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
        </button>
        {open && (
          <ul
            role="listbox"
            className="relative z-50 mt-0.5 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-background py-1 shadow-lg"
          >
            {headers.map((h, i) => {
              const name = columnHeadingLabel(h, i);
              const disabled = i === disabledIndex;
              const selected = i === value;
              return (
                <li key={`${dataAttr}-${i}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={disabled}
                    data-axis-option={i}
                    title={name}
                    onClick={() => { if (!disabled) { onChange(i); setOpen(false); } }}
                    className={cn(
                      "flex w-full items-center px-2 py-1.5 text-left text-xs text-foreground",
                      disabled && "cursor-not-allowed opacity-40",
                      selected && "bg-primary/15 font-semibold",
                      !disabled && !selected && "hover:bg-muted",
                    )}
                  >
                    {name}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </label>
  );
}

export function GraphScoreFields({
  score,
  onChange,
}: {
  score: GraphScore;
  onChange: (next: GraphScore) => void;
}) {
  const s = normalizeGraphScore(score);
  const patch = (p: Partial<GraphScore>) => onChange(normalizeGraphScore({ ...s, ...p }));
  return (
    <div data-add-graph className="flex flex-col gap-1.5 text-[11px] text-current">
      <label className="inline-flex items-center gap-1.5 font-semibold">
        <input
          type="checkbox"
          data-add-graph-toggle
          checked={s.enabled}
          onChange={(e) => patch({ enabled: e.target.checked })}
        />
        Add graph
      </label>
      {s.enabled && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-1">
            Maximum coordinates
            <input
              type="number"
              min={1}
              step={1}
              data-max-coordinates
              className="h-7 w-16 rounded border border-current/40 bg-white px-1 text-right text-neutral-900 tabular-nums"
              value={s.maxCoordinates}
              onChange={(e) => patch({ maxCoordinates: Number(e.target.value) })}
            />
          </label>
          <label className="inline-flex items-center gap-1">
            Marks per coordinate
            <input
              type="number"
              min={0}
              step="any"
              data-marks-per-coordinate
              className="h-7 w-16 rounded border border-current/40 bg-white px-1 text-right text-neutral-900 tabular-nums"
              value={s.marksPerCoordinate}
              onChange={(e) => patch({ marksPerCoordinate: Number(e.target.value) })}
            />
          </label>
          <span className="text-muted-foreground">Max score {s.maxCoordinates * s.marksPerCoordinate}</span>
        </div>
      )}
    </div>
  );
}

export type { GraphAxes };
