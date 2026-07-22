// Teacher-only live controls for a game's Time Bar.
import { useMemo } from "react";
import { Timer, Play, Pause, RotateCcw, Trash2, Plus, Minus } from "lucide-react";
import { useGameTimeBar, timeBarActions } from "@/hooks/useGameTimeBar";

const fmt = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
};

export function TimeBarControl({ gameId, barLabel, segments }: { gameId: string; barLabel: string; segments: number }) {
  const tb = useGameTimeBar(gameId);
  const durationMinutes = useMemo(() => Math.round((tb.row?.duration_seconds ?? 600) / 60), [tb.row?.duration_seconds]);

  if (tb.loading) return null;
  if (!tb.row) return null;

  const row = tb.row;
  const running = tb.running;
  const paused = tb.paused;
  const slots = tb.slotsLit(segments);

  const onDurationChange = (mins: number) => {
    if (!Number.isFinite(mins)) return;
    void timeBarActions.setDuration(gameId, Math.max(1, Math.round(mins)) * 60);
  };
  const onStart = () => void timeBarActions.start(gameId);
  const onPause = () => void timeBarActions.pause(gameId);
  const onResume = () => void timeBarActions.resume(gameId, row);
  const onAdd = () => void timeBarActions.adjustDuration(gameId, row, 60);
  const onSub = () => void timeBarActions.adjustDuration(gameId, row, -60);
  const onReset = () => void timeBarActions.reset(gameId);
  const onRemove = () => {
    if (!confirm("Remove the Time Bar?")) return;
    void timeBarActions.remove(gameId);
  };

  return (
    <div className="rounded-lg border border-border bg-card/60 px-3 py-2 text-xs backdrop-blur">
      <div className="mb-1.5 flex items-center gap-2 flex-wrap">
        <Timer className="h-3.5 w-3.5 text-primary" />
        <span className="font-semibold">Time Bar</span>
        <span className="text-muted-foreground">· {barLabel} ·</span>
        <span className="tabular-nums text-primary">{fmt(tb.elapsedMs)} / {fmt(tb.durationMs)}</span>
        <span className="text-muted-foreground">·</span>
        <span className="tabular-nums">{slots} / {segments} slots</span>
        {tb.expired && <span className="ml-1 rounded-full border border-destructive/50 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">Time expired</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1.5">
          <span className="text-muted-foreground">Duration</span>
          <input type="number" min={1} value={durationMinutes} onChange={(e) => onDurationChange(Number(e.target.value))} className="h-7 w-16 rounded border border-input bg-background px-1.5 text-xs tabular-nums" />
          <span className="text-muted-foreground">min</span>
        </label>
        {!running && !paused && (<button type="button" onClick={onStart} className="inline-flex items-center gap-1 rounded border border-primary/50 bg-primary/10 px-2 py-1 text-primary hover:bg-primary/20"><Play className="h-3 w-3" /> Start</button>)}
        {running && (<button type="button" onClick={onPause} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-accent"><Pause className="h-3 w-3" /> Pause</button>)}
        {paused && (<button type="button" onClick={onResume} className="inline-flex items-center gap-1 rounded border border-primary/50 bg-primary/10 px-2 py-1 text-primary hover:bg-primary/20"><Play className="h-3 w-3" /> Resume</button>)}
        <button type="button" onClick={onAdd} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-accent"><Plus className="h-3 w-3" /> 1m</button>
        <button type="button" onClick={onSub} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-accent"><Minus className="h-3 w-3" /> 1m</button>
        <button type="button" onClick={onReset} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-accent"><RotateCcw className="h-3 w-3" /> Reset</button>
        <button type="button" onClick={onRemove} className="ml-auto inline-flex items-center gap-1 rounded border border-destructive/50 px-2 py-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /> Remove</button>
      </div>
    </div>
  );
}
