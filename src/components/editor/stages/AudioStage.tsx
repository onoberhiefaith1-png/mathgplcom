import { AudioLines, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Waveform } from "./Waveform";
import { formatTimecode } from "@/lib/editor/types";
import type { WorkflowApi } from "@/lib/editor/useWorkflow";

export function AudioStage({ wf }: { wf: WorkflowApi }) {
  const asset = wf.state.audio;
  const busy = wf.busy === 2;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        The audio is decoded and rendered from your edited timeline right here in the browser. Only
        this audio asset is sent to the AI — the video file never leaves your device.
      </p>

      {wf.audioStale && asset ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs">
          <p className="font-medium text-destructive">
            The video was re-cut since this audio was extracted.
          </p>
          <p className="mt-1 text-muted-foreground">
            This change may affect the transcript, paraphrase, voice and timing for the changed
            section.
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => void wf.extractAudio()} disabled={busy}>
              Re-extract audio
            </Button>
            <Button size="sm" variant="outline" onClick={wf.keepDownstream}>
              Keep existing
            </Button>
          </div>
        </div>
      ) : null}

      {asset && wf.audio ? (
        <div className="space-y-3">
          <Waveform peaks={wf.audio.peaks} />
          <audio controls src={wf.audio.url} className="w-full" />
          <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
            <Stat label="Length" value={formatTimecode(asset.duration, false)} />
            <Stat label="Size" value={`${(asset.size / 1024 / 1024).toFixed(2)} MB`} />
            <Stat label="Format" value="WAV · 16 kHz mono" />
            <Stat label="Source" value="Edited timeline" />
          </dl>
          <Button size="sm" variant="outline" onClick={() => void wf.extractAudio()} disabled={busy}>
            <RefreshCw className="mr-1.5 size-4" />
            Re-extract
          </Button>
        </div>
      ) : (
        <Button onClick={() => void wf.extractAudio()} disabled={busy}>
          <AudioLines className="mr-1.5 size-4" />
          {busy ? "Extracting…" : "Extract audio"}
        </Button>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary/50 p-2">
      <dt className="text-[10px] uppercase tracking-wide">{label}</dt>
      <dd className="font-mono text-foreground">{value}</dd>
    </div>
  );
}
