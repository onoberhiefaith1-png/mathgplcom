// Teacher-only live controls for a game's Time Bar.
//
// The Time Bar is part of the Adventure engine: the first Progress Bar is
// always reserved for it, so this section is permanent. Choosing "None" only
// disables the countdown — every setting is preserved for later.
import { Timer, Play, Pause, RotateCcw, Plus, Minus } from "lucide-react";
import { useGameTimeBar } from "@/hooks/useGameTimeBar";
import { toast } from "@/hooks/use-toast";
import { TIME_DURATION_OPTIONS } from "@/lib/games/types";

const fmt = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
};

const labelFor = (seconds: number): string => {
  const hit = TIME_DURATION_OPTIONS.find((o) => o.seconds === seconds);
  if (hit) return hit.label;
  const mins = Math.round(seconds / 60);
  return `${mins} minute${mins === 1 ? "" : "s"}`;
};

const SHELL =
  "rounded-lg border border-border bg-card/60 px-3 py-2 text-xs backdrop-blur";

export function TimeBarControl({ gameId, barLabel, segments }: { gameId: string; barLabel?: string; segments: number }) {
  const tb = useGameTimeBar(gameId);

  const run = (p: Promise<void>) => {
    void p.catch((e) =>
      toast({
        title: "Time Bar update failed",
        description: String((e as Error)?.message ?? e),
        variant: "destructive",
      }),
    );
  };

  // The section always exists so the interface stays consistent, even while the
  // engine's row is still being read.
  if (tb.loading || !tb.row) {
    return (
      <div className={SHELL}>
        <Header barLabel={barLabel} />
        <p className="text-muted-foreground">Preparing the Time Bar…</p>
      </div>
    );
  }

  const duration = Math.max(0, Number(tb.row.duration_seconds) || 0);
  const remainingMs = Math.max(0, tb.durationMs - tb.elapsedMs);

  const durationSelect = (
    <label className="inline-flex items-center gap-1.5">
      <span className="text-muted-foreground">Duration</span>
      <select
        value={String(duration)}
        onChange={(e) => run(tb.actions.setDuration(Number(e.target.value)))}
        className="h-7 rounded border border-input bg-background px-1.5 text-xs"
      >
        {TIME_DURATION_OPTIONS.map((o) => (
          <option key={o.seconds} value={o.seconds}>
            {o.label}
          </option>
        ))}
        {!TIME_DURATION_OPTIONS.some((o) => o.seconds === duration) && (
          <option value={duration}>{labelFor(duration)}</option>
        )}
      </select>
    </label>
  );

  // "None" — no countdown, no timeout, unlimited play. Settings stay put.
  if (tb.noTime) {
    return (
      <div className={SHELL}>
        <Header barLabel={barLabel} />
        <div className="flex flex-wrap items-center gap-3">
          {durationSelect}
          <p className="text-muted-foreground">
            No countdown is active for this Adventure. Enable a duration at any time to activate the countdown.
          </p>
        </div>
      </div>
    );
  }

  const slots = tb.slotsLit(segments);

  return (
    <div className={SHELL}>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <Timer className="h-3.5 w-3.5 text-primary" />
        <span className="font-semibold">Time Bar</span>
        <span className="text-muted-foreground">· {labelFor(duration)} ·</span>
        <span className="tabular-nums text-primary">{fmt(remainingMs)} remaining</span>
        <span className="text-muted-foreground">·</span>
        <span className="tabular-nums">{slots} / {segments} slots</span>
        {tb.expired && (
          <span className="ml-1 rounded-full border border-destructive/50 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
            Time expired
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {durationSelect}
        {!tb.running && !tb.paused && (
          <button type="button" onClick={() => run(tb.actions.start())} className="inline-flex items-center gap-1 rounded border border-primary/50 bg-primary/10 px-2 py-1 text-primary hover:bg-primary/20">
            <Play className="h-3 w-3" /> Start
          </button>
        )}
        {tb.running && (
          <button type="button" onClick={() => run(tb.actions.pause())} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-accent">
            <Pause className="h-3 w-3" /> Pause
          </button>
        )}
        {tb.paused && (
          <button type="button" onClick={() => run(tb.actions.resume())} className="inline-flex items-center gap-1 rounded border border-primary/50 bg-primary/10 px-2 py-1 text-primary hover:bg-primary/20">
            <Play className="h-3 w-3" /> Resume
          </button>
        )}
        <button type="button" onClick={() => run(tb.actions.adjustDuration(60))} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-accent">
          <Plus className="h-3 w-3" /> 1 min
        </button>
        <button type="button" onClick={() => run(tb.actions.adjustDuration(-60))} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-accent">
          <Minus className="h-3 w-3" /> 1 min
        </button>
        <button type="button" onClick={() => run(tb.actions.reset())} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-accent">
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>
    </div>
  );
}

function Header({ barLabel }: { barLabel?: string }) {
  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-2">
      <Timer className="h-3.5 w-3.5 text-primary" />
      <span className="font-semibold">Time Bar</span>
      {barLabel && <span className="text-muted-foreground">· {barLabel}</span>}
    </div>
  );
}

export default TimeBarControl;
