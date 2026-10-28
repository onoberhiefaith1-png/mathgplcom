// Phase 8 — Time Bar UI. Renders a live countdown for a given progress element
// and, when `canControl` is true, exposes teacher controls (duration, start,
// pause/resume, reset). Backed by useTimeBar (game_time_bars).
import { useMemo, useState } from "react";
import { useTimeBar } from "@/hooks/useTimeBar";

interface Props {
  gameId: string;
  progressElementId: string;
  label?: string;
  canControl?: boolean;
}

const fmt = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const TimeBarControls = ({ gameId, progressElementId, label, canControl = false }: Props) => {
  const { row, remainingMs, running, start, pause, resume, reset, setDuration } =
    useTimeBar(gameId, progressElementId);
  const [minutes, setMinutes] = useState<string>("");

  const pct = useMemo(() => {
    if (!row) return 0;
    const totalMs = row.duration_seconds * 1000;
    if (totalMs <= 0) return 0;
    return Math.max(0, Math.min(1, remainingMs / totalMs));
  }, [row, remainingMs]);

  return (
    <div className="rounded-md border border-border bg-card p-3 text-sm">
      <div className="flex items-baseline justify-between">
        <span className="font-medium">{label ?? "Time bar"}</span>
        <span className="tabular-nums text-foreground">{fmt(remainingMs)}</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded bg-muted">
        <div
          className={`h-full transition-[width] duration-200 ${running ? "bg-primary" : "bg-muted-foreground/50"}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      {canControl && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder={`${Math.round((row?.duration_seconds ?? 600) / 60)}m`}
            className="w-20 rounded border border-border bg-background px-2 py-1 text-foreground"
          />
          <button
            type="button"
            onClick={() => {
              const n = Number(minutes);
              if (Number.isFinite(n) && n > 0) setDuration(n * 60);
            }}
            className="rounded border border-border px-2 py-1 hover:bg-accent"
          >
            Set
          </button>
          {!row?.started_at ? (
            <button type="button" onClick={() => start()} className="rounded bg-primary px-2 py-1 text-primary-foreground">
              Start
            </button>
          ) : row.paused_at ? (
            <button type="button" onClick={() => resume()} className="rounded bg-primary px-2 py-1 text-primary-foreground">
              Resume
            </button>
          ) : (
            <button type="button" onClick={() => pause()} className="rounded border border-border px-2 py-1 hover:bg-accent">
              Pause
            </button>
          )}
          <button type="button" onClick={() => reset()} className="rounded border border-border px-2 py-1 hover:bg-accent">
            Reset
          </button>
        </div>
      )}
    </div>
  );
};

export default TimeBarControls;
