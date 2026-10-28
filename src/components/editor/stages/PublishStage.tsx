import { useState } from "react";
import { Check, Download, Save, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WorkflowApi } from "@/lib/editor/useWorkflow";

export function PublishStage({ wf, onSave }: { wf: WorkflowApi; onSave: () => void }) {
  const [note, setNote] = useState(wf.state.published?.note ?? "");
  const checks = [
    { label: "Video edited", done: true },
    { label: "Audio extracted", done: Boolean(wf.state.audio) },
    { label: "Transcript approved", done: wf.state.transcript.length > 0 },
    ...(wf.state.paraphraseEnabled
      ? [{ label: "Script paraphrased", done: wf.state.paraphrase.length > 0 }]
      : []),
    { label: "Voice generated", done: Object.keys(wf.state.voice).length > 0 },
    {
      label: "Every segment fits its clip",
      done:
        wf.fits.some((fit) => fit.rawDuration > 0) &&
        !wf.fits.some((fit) => fit.status === "over" || fit.status === "manual"),
    },
    { label: "Final mix rendered", done: Boolean(wf.state.generatedTrack) },
    { label: "Final video rendered", done: Boolean(wf.generatedVideo) },
  ];

  return (
    <div className="space-y-3">
      <ul className="grid gap-1.5 text-xs sm:grid-cols-2">
        {checks.map((check) => (
          <li
            key={check.label}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
              check.done ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            <Check className="size-3.5" />
            {check.label}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onSave}>
          <Save className="mr-1.5 size-4" />
          Save project
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" disabled={!wf.generatedTrack || wf.busy === 9}>
              <Download className="mr-1.5 size-4" />
              Download final video
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
              Original picture + generated audio
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => void wf.downloadFinalVideo({ subtitles: false })}>
              Download without subtitles
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void wf.downloadFinalVideo({ subtitles: true })}>
              Download with {wf.subtitleLanguage} subtitles
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="outline" onClick={wf.exportAudio} disabled={!wf.generatedTrack}>
          <Download className="mr-1.5 size-4" />
          Generated audio
        </Button>
        <Button size="sm" variant="outline" onClick={() => wf.exportSubtitles("srt")}>
          <Download className="mr-1.5 size-4" />
          Subtitles (.srt)
        </Button>
        <Button size="sm" variant="outline" onClick={() => wf.exportSubtitles("vtt")}>
          <Download className="mr-1.5 size-4" />
          Subtitles (.vtt)
        </Button>
      </div>

      <div className="rounded-md border border-border p-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[220px] flex-1 text-xs text-muted-foreground">
            Version note
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Module 3 — Quadratic equations, French revoice"
              className="mt-1 h-9"
            />
          </label>
          <Button size="sm" onClick={() => wf.saveVersion(note)} disabled={!wf.generatedTrack}>
            <Upload className="mr-1.5 size-4" />
            Save this version
          </Button>
          <Button size="sm" variant="outline" onClick={() => wf.publish(note)}>
            Mark lesson ready
          </Button>
        </div>

        {wf.versions.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {wf.versions.map((version) => (
              <li
                key={version.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-secondary/50 px-2 py-1.5 text-xs"
              >
                <span>
                  <span className="font-medium">{version.label}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {version.duration.toFixed(1)}s · {new Date(version.at).toLocaleString()}
                    {version.note ? ` · ${version.note}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px]"
                    onClick={() => wf.downloadVersion(version.id)}
                  >
                    <Download className="mr-1 size-3.5" />
                    Audio
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px] text-destructive"
                    onClick={() => wf.deleteVersion(version.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[11px] text-muted-foreground">
            No versions saved yet. Each version keeps its own language, voice, mix and subtitles and
            points at the same untouched original video.
          </p>
        )}
      </div>

      {wf.state.published ? (
        <p className="rounded-md bg-secondary/60 p-2 text-[11px] text-muted-foreground">
          Marked ready {new Date(wf.state.published.at).toLocaleString()}
          {wf.state.published.note ? ` — ${wf.state.published.note}` : ""}. Your original upload is
          still untouched, and every stage stays editable.
        </p>
      ) : null}
    </div>
  );
}
