import { useMemo, useState, type ReactNode } from "react";
import { AudioLines, Flag, Pause, Play, Trash2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Scene } from "@/lib/games/types";
import { cn } from "@/lib/utils";

export const fmtTime = (t: number) => {
  const s = Math.max(0, Math.floor(t || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

interface CheckpointTimelineProps {
  duration: number;
  currentTime: number;
  playing: boolean;
  checkpoints: Scene[];
  activeId: string | null;
  onTogglePlay: () => void;
  onSeek: (t: number) => void;
  onAdd: (start: number, end: number) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPatch: (id: string, patch: Partial<Scene>) => void;
  onChangeVideo: () => void;
  onRemoveVideo: () => void;
  /** Collapsed by default: the loop detail form only shows when the toolbar is expanded. */
  expanded?: boolean;
  /** Toggles the Narration library panel (beside Set Start). */
  onToggleNarration?: () => void;
  narrationOpen?: boolean;
  narrationCount?: number;
  /** Rendered inside the toolbar so the panel floats beside the timeline. */
  narrationPanel?: ReactNode;
}

/**
 * Video timeline + Checkpoint authoring strip. A Checkpoint is just a loop
 * region (start → end) inside the background video; selecting one makes the
 * existing Adventure editor edit that Checkpoint's own elements.
 */
const CheckpointTimeline = ({
  duration,
  currentTime,
  playing,
  checkpoints,
  activeId,
  onTogglePlay,
  onSeek,
  onAdd,
  onSelect,
  onDelete,
  onPatch,
  onChangeVideo,
  onRemoveVideo,
  expanded = false,
  onToggleNarration,
  narrationOpen = false,
  narrationCount = 0,
  narrationPanel,
}: CheckpointTimelineProps) => {
  const [markStart, setMarkStart] = useState<number | null>(null);
  const active = useMemo(() => checkpoints.find((c) => c.id === activeId) ?? null, [checkpoints, activeId]);
  const dur = duration > 0 ? duration : 1;
  const cmpBtn = "h-7 gap-1 px-2 text-[11px]";
  const cmpIcon = "h-3.5 w-3.5";

  return (
    <div className="relative z-10 shrink-0 space-y-1.5 border-b border-border/40 bg-background/80 px-3 py-1 backdrop-blur">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="icon" variant="secondary" className="h-7 w-7" onClick={onTogglePlay} title={playing ? "Pause" : "Play"}>
          {playing ? <Pause className={cmpIcon} /> : <Play className={cmpIcon} />}
        </Button>
        <span className="tabular-nums text-[11px] text-muted-foreground">
          {fmtTime(currentTime)} / {fmtTime(duration)}
        </span>

        {markStart == null ? (
          <Button size="sm" className={cmpBtn} variant="secondary" onClick={() => setMarkStart(currentTime)}>
            <Flag className={cmpIcon} /> Set Start
          </Button>
        ) : (
          <>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
              Start {fmtTime(markStart)}
            </span>
            <Button
              size="sm"
              className={cmpBtn}
              onClick={() => {
                onAdd(markStart, Math.max(markStart + 0.5, currentTime));
                setMarkStart(null);
              }}
            >
              <Flag className={cmpIcon} /> Set End &amp; Add Checkpoint
            </Button>
            <Button size="sm" className={cmpBtn} variant="ghost" onClick={() => setMarkStart(null)}>
              Cancel
            </Button>
          </>
        )}

        {onToggleNarration && (
          <Button
            size="sm"
            className={cmpBtn}
            variant={narrationOpen ? "default" : "secondary"}
            onClick={onToggleNarration}
          >
            <AudioLines className={cmpIcon} /> Narration
            {narrationCount > 0 && (
              <span className="ml-0.5 rounded bg-black/15 px-1 text-[10px] tabular-nums">{narrationCount}</span>
            )}
          </Button>
        )}
        {narrationPanel}



        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" className={cmpBtn} variant="ghost" onClick={onChangeVideo}>
            <Video className={cmpIcon} /> Change Video
          </Button>
          <Button size="sm" className={cmpBtn} variant="ghost" onClick={onRemoveVideo} title="Back to a static background">
            <Trash2 className={cmpIcon} /> Remove
          </Button>
        </div>
      </div>

      {/* Scrubber with checkpoint regions drawn on it */}
      <div className="relative h-4 w-full rounded-md bg-muted/60">

        {checkpoints.map((c) => {
          const s = ((c.loopStart ?? 0) / dur) * 100;
          const w = Math.max(0.8, (((c.loopEnd ?? 0) - (c.loopStart ?? 0)) / dur) * 100);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onSelect(c.id);
                onSeek(c.loopStart ?? 0);
              }}
              title={`${c.title} · ${fmtTime(c.loopStart ?? 0)}–${fmtTime(c.loopEnd ?? 0)}`}
              className={cn(
                "absolute inset-y-0 rounded-sm border transition",
                c.id === activeId
                  ? "border-primary bg-primary/40"
                  : "border-primary/40 bg-primary/20 hover:bg-primary/30",
              )}
              style={{ left: `${s}%`, width: `${w}%` }}
            />
          );
        })}
        {markStart != null && (
          <div
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-amber-400"
            style={{ left: `${(markStart / dur) * 100}%` }}
          />
        )}
        <input
          type="range"
          min={0}
          max={dur}
          step={0.05}
          value={Math.min(currentTime, dur)}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Video position"
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent"
        />
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-foreground"
          style={{ left: `${(Math.min(currentTime, dur) / dur) * 100}%` }}
        />
      </div>

      {/* Checkpoint chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {checkpoints.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            Play the video, then Set Start and Set End to create your first Checkpoint.
          </p>
        )}
        {checkpoints.map((c, i) => (
          <div
            key={c.id}
            className={cn(
              "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px]",
              c.id === activeId ? "border-primary bg-primary/10 text-primary" : "border-border/60",
            )}
          >
            <button
              type="button"
              onClick={() => {
                onSelect(c.id);
                onSeek(c.loopStart ?? 0);
              }}
              className="font-medium"
            >
              {i + 1}. {c.title} · {fmtTime(c.loopStart ?? 0)}–{fmtTime(c.loopEnd ?? 0)}
            </button>
            <button
              type="button"
              onClick={() => onDelete(c.id)}
              aria-label={`Delete ${c.title}`}
              className="rounded p-0.5 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Active checkpoint settings — loop bounds + per-checkpoint timer.
          Hidden until the toolbar is expanded, so the default chrome stays slim. */}
      {active && expanded && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">

          <div className="w-40">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Name</Label>
            <Input
              value={active.title}
              onChange={(e) => onPatch(active.id, { title: e.target.value })}
              className="h-8"
            />
          </div>
          <div className="w-24">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Loop start (s)</Label>
            <Input
              type="number"
              step="0.1"
              value={Number(active.loopStart ?? 0).toFixed(1)}
              onChange={(e) => onPatch(active.id, { loopStart: Math.max(0, Number(e.target.value) || 0) })}
              className="h-8"
            />
          </div>
          <div className="w-24">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Loop end (s)</Label>
            <Input
              type="number"
              step="0.1"
              value={Number(active.loopEnd ?? 0).toFixed(1)}
              onChange={(e) => onPatch(active.id, { loopEnd: Math.max(0.5, Number(e.target.value) || 0) })}
              className="h-8"
            />
          </div>
          <div className="flex items-center gap-2 pb-1">
            <Switch
              checked={Boolean(active.timerEnabled)}
              onCheckedChange={(v) => onPatch(active.id, { timerEnabled: v })}
              id="cp-timer"
            />
            <Label htmlFor="cp-timer" className="text-xs">Timer</Label>
          </div>
          {active.timerEnabled && (
            <>
              <div className="w-28">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Time limit (s)</Label>
                <Input
                  type="number"
                  value={active.timeLimit ?? 300}
                  onChange={(e) => onPatch(active.id, { timeLimit: Math.max(10, Number(e.target.value) || 10) })}
                  className="h-8"
                />
              </div>
              <div className="flex items-center gap-2 pb-1">
                <Switch
                  checked={active.timerVisible !== false}
                  onCheckedChange={(v) => onPatch(active.id, { timerVisible: v })}
                  id="cp-timer-vis"
                />
                <Label htmlFor="cp-timer-vis" className="text-xs">Show countdown</Label>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CheckpointTimeline;
