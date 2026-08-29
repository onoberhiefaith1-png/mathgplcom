import { Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTimecode } from "@/lib/editor/types";
import type { WorkflowApi } from "@/lib/editor/useWorkflow";

const STATUS_LABEL = {
  synchronized: "Synchronized",
  tight: "Tight",
  over: "Needs adjustment",
  manual: "Requires manual adjustment",
  none: "Not generated",
} as const;

const STATUS_TONE = {
  synchronized: "bg-primary/15 text-primary",
  tight: "bg-amber-500/15 text-amber-400",
  over: "bg-destructive/15 text-destructive",
  manual: "bg-destructive/15 text-destructive",
  none: "bg-muted text-muted-foreground",
} as const;

export function TimingStage({ wf, onSeek }: { wf: WorkflowApi; onSeek: (t: number) => void }) {
  const generated = wf.fits.filter((fit) => fit.rawDuration > 0);
  if (generated.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Generate the voice in Stage 6 — timing validates those clips against the original spoken
        time of each segment.
      </p>
    );
  }
  const over = generated.filter((fit) => fit.status === "over" || fit.status === "manual");
  const tight = generated.filter((fit) => fit.status === "tight");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={wf.autoFit}>
          <Gauge className="mr-1.5 size-4" />
          Validate &amp; auto-fit all
        </Button>
        <span className="text-xs text-muted-foreground">
          {over.length === 0
            ? tight.length === 0
              ? "Every segment speaks within its original spoken time — clip boundaries and total length are unchanged."
              : `${tight.length} segment${tight.length === 1 ? "" : "s"} run past the original speech but still fit the clip.`
            : `${over.length} segment${over.length === 1 ? "" : "s"} overflow their clip — rewrite shorter or adjust before rendering.`}
        </span>
      </div>

      <ul className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
        {generated.map((fit) => (
          <li
            key={fit.id}
            className={`rounded-md border p-2 ${
              fit.status === "over" || fit.status === "manual"
                ? "border-destructive/50"
                : "border-border"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                className="font-mono text-[11px] text-primary hover:underline"
                onClick={() => onSeek(Math.max(0, fit.start))}
              >
                {formatTimecode(fit.start, false)} → {formatTimecode(fit.end, false)}
              </button>
              <span className={`rounded px-1.5 py-0.5 text-[10px] ${STATUS_TONE[fit.status]}`}>
                {STATUS_LABEL[fit.status]}
                {fit.status === "over" || fit.status === "manual"
                  ? ` +${fit.overflow.toFixed(2)}s`
                  : ""}
              </span>
            </div>

            <p className="mt-1 line-clamp-2 text-sm">{fit.text}</p>

            {fit.status === "manual" ? (
              <p className="mt-1 rounded bg-destructive/10 p-1.5 text-[11px] text-destructive">
                Three shortening attempts were used and this segment still does not fit. Edit the
                text yourself in the script stage, then regenerate just this segment.
              </p>
            ) : null}

            <div className="mt-1.5 grid gap-1 font-mono text-[11px] text-muted-foreground sm:grid-cols-2">
              <span>
                original clip {fit.window.toFixed(2)}s · spoke {fit.budget.toFixed(2)}s
              </span>
              <span>
                generated {fit.fitted.toFixed(2)}s speech + {fit.silence.toFixed(2)}s silence
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              <label className="flex items-center gap-2">
                <span>speed</span>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.01}
                  value={fit.speed}
                  onChange={(e) => wf.setSpeed(fit.id, Number(e.target.value))}
                  className="w-28 accent-primary"
                />
                <span className="w-10 font-mono text-foreground">{fit.speed.toFixed(2)}x</span>
              </label>
              <label className="flex items-center gap-2">
                <span>nudge</span>
                <input
                  type="range"
                  min={-2}
                  max={2}
                  step={0.05}
                  value={fit.offset}
                  onChange={(e) => wf.setOffset(fit.id, Number(e.target.value))}
                  className="w-24 accent-primary"
                />
                <span className="w-12 font-mono text-foreground">
                  {fit.offset >= 0 ? "+" : ""}
                  {fit.offset.toFixed(2)}s
                </span>
              </label>
              {wf.voiceUrls[fit.id] ? (
                <audio controls src={wf.voiceUrls[fit.id]} className="h-7 max-w-[220px]" />
              ) : null}
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                disabled={wf.busy !== null}
                onClick={() => void wf.regenerateShorter(fit.id)}
              >
                Regenerate shorter
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
