import { AlertCircle, Loader2, RotateCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { WorkflowApi } from "@/lib/editor/useWorkflow";

function timecode(seconds: number): string {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${rest
    .toFixed(3)
    .padStart(6, "0")}`;
}

export function ParaphraseStage({ wf }: { wf: WorkflowApi }) {
  const busy = wf.busy === 4;
  const transcript = wf.state.transcript;
  const paraphrase = new Map(wf.state.paraphrase.map((p) => [p.id, p]));
  const stale = wf.staleParaphraseIds;
  const missing = transcript.filter((t) => !paraphrase.has(t.id)).map((t) => t.id);

  if (transcript.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Generate the transcript in Stage 3 — the paraphrase rewrites that text, nothing else.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 text-xs text-muted-foreground">
          Tone / style
          <Input
            value={wf.state.paraphraseTone}
            onChange={(e) => wf.setTone(e.target.value)}
            placeholder="clear and natural"
            className="mt-1 h-9"
          />
        </label>
        <Button
          size="sm"
          disabled={busy || missing.length === 0}
          onClick={() => void wf.runParaphrase(missing)}
        >
          {busy ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 size-4" />
          )}
          Generate all missing{missing.length ? ` (${missing.length})` : ""}
        </Button>
        {stale.length > 0 && wf.state.paraphrase.length > 0 ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void wf.runParaphrase(stale)}>
            Regenerate changed ({stale.length})
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void wf.runParaphrase()}>
          Rewrite everything
        </Button>
      </div>
      {busy && wf.progress ? (
        <p className="text-xs text-muted-foreground">{wf.progress}</p>
      ) : null}

      <ul className="max-h-[460px] space-y-2 overflow-y-auto pr-1">
        {transcript.map((segment) => {
          const rewritten = paraphrase.get(segment.id);
          const status = wf.paraphraseStatus[segment.id];
          const generating = status?.state === "generating";
          const isStale = stale.includes(segment.id);
          return (
            <li key={segment.id} className="rounded-md border border-border p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[11px] text-muted-foreground">
                  {timecode(segment.start)} → {timecode(segment.end)}
                </p>
                <Button
                  size="sm"
                  variant={rewritten ? "outline" : "default"}
                  className="h-7 px-2 text-xs"
                  disabled={generating}
                  onClick={() => void wf.runParaphrase([segment.id])}
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-1 size-3.5 animate-spin" />
                      Generating…
                    </>
                  ) : rewritten ? (
                    <>
                      <RotateCw className="mr-1 size-3.5" />
                      Regenerate
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-1 size-3.5" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Original
                  </p>
                  <Textarea
                    value={segment.text}
                    onChange={(e) => wf.editTranscript(segment.id, e.target.value)}
                    className="mt-1 min-h-[64px] resize-y text-sm"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Paraphrased
                    </p>
                    {isStale && rewritten ? (
                      <span className="text-[10px] text-destructive">Out of date</span>
                    ) : null}
                  </div>
                  <Textarea
                    value={rewritten?.text ?? ""}
                    placeholder={generating ? "Generating…" : "Not generated yet"}
                    onChange={(e) => wf.editParaphrase(segment.id, e.target.value)}
                    className="mt-1 min-h-[64px] resize-y text-sm"
                  />
                </div>
              </div>
              {status?.state === "error" ? (
                <div className="mt-2 flex items-start gap-1.5 text-[11px] text-destructive">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  <span className="flex-1">{status.error}</span>
                  <button
                    type="button"
                    className="underline"
                    onClick={() => void wf.runParaphrase([segment.id])}
                  >
                    Retry
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
