import { FileText, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatTimecode } from "@/lib/editor/types";
import type { WorkflowApi } from "@/lib/editor/useWorkflow";

interface Props {
  wf: WorkflowApi;
  tlTime: number;
  onSeek: (time: number) => void;
}

export function TranscriptStage({ wf, tlTime, onSeek }: Props) {
  const busy = wf.busy === 3;
  const segments = wf.state.transcript;

  if (!wf.state.audio) {
    return (
      <p className="text-xs text-muted-foreground">
        Extract the audio in Stage 2 first — the transcript is generated from that audio asset.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void wf.runTranscript()} disabled={busy}>
          <FileText className="mr-1.5 size-4" />
          {segments.length ? "Re-transcribe audio" : "Transcribe audio"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {segments.length
            ? `${segments.length} segments · click a timecode to jump there`
            : "Speech-to-text runs on the extracted audio only."}
        </span>
      </div>

      {segments.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
          <span className="text-[11px] text-muted-foreground">
            Detected spoken language — this is the original script language used for paraphrasing,
            voice and captions.
          </span>
          <Input
            value={wf.state.sourceLanguage}
            onChange={(e) => wf.setSourceLanguage(e.target.value)}
            className="h-8 w-40 text-xs"
          />
        </div>
      ) : null}

      {segments.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
          <Wand2 className="size-4 text-muted-foreground" />
          <span className="flex-1 text-[11px] text-muted-foreground">
            Paraphrasing is optional. The normal flow goes straight from this transcript to voice
            generation — turn it on only if you want the wording rewritten first.
          </span>
          <Button
            size="sm"
            variant={wf.state.paraphraseEnabled ? "outline" : "default"}
            onClick={() => wf.setParaphraseEnabled(!wf.state.paraphraseEnabled)}
          >
            {wf.state.paraphraseEnabled ? "Skip paraphrasing" : "Add paraphrase stage"}
          </Button>
        </div>
      ) : null}

      {wf.transcriptStale && segments.length > 0 ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-muted-foreground">
          The audio changed after this transcript was generated. Re-transcribe to stay in sync, or
          keep the current version.
        </div>
      ) : null}

      {segments.length > 0 ? (
        <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {segments.map((segment) => {
            const active = tlTime >= segment.start && tlTime < segment.end;
            return (
              <li
                key={segment.id}
                className={`rounded-md border p-2 ${active ? "border-primary/60 bg-secondary/40" : "border-border"}`}
              >
                <button
                  type="button"
                  onClick={() => onSeek(segment.start)}
                  className="font-mono text-[11px] text-primary hover:underline"
                >
                  {formatTimecode(segment.start)} – {formatTimecode(segment.end)}
                </button>
                <Textarea
                  value={segment.text}
                  onChange={(e) => wf.editTranscript(segment.id, e.target.value)}
                  className="mt-1 min-h-[52px] resize-y text-sm"
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
