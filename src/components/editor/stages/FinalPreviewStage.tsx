import { Download, Film, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Waveform } from "./Waveform";
import { SyncedVideoPreview } from "../SyncedVideoPreview";
import type { Segment } from "@/lib/editor/types";
import type { WorkflowApi } from "@/lib/editor/useWorkflow";
import { useState } from "react";

interface Props {
  wf: WorkflowApi;
  videoSrc: string;
  segments: Segment[];
  duration: number;
}

export function FinalPreviewStage({ wf, videoSrc, segments, duration }: Props) {
  const [track, setTrack] = useState<"generated" | "original">("generated");
  const [showSubtitles, setShowSubtitles] = useState(true);
  const busy = wf.busy === 9;
  const mix = wf.state.mix;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        This is the finished lesson: your edited picture with the generated speech placed back on
        the original timeline, segment by segment. Switch between the generated mix and the original
        audio to compare before publishing.
      </p>

      <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-28">Voice level</span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={mix.voiceVolume}
            onChange={(e) => wf.setMix({ voiceVolume: Number(e.target.value) })}
            className="flex-1 accent-primary"
          />
          <span className="w-10 font-mono text-foreground">{mix.voiceVolume.toFixed(2)}</span>
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={mix.keepOriginal}
            onChange={(e) => wf.setMix({ keepOriginal: e.target.checked })}
            className="accent-primary"
          />
          Keep original audio as background
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-28">Background level</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={mix.originalVolume}
            disabled={!mix.keepOriginal}
            onChange={(e) => wf.setMix({ originalVolume: Number(e.target.value) })}
            className="flex-1 accent-primary disabled:opacity-40"
          />
          <span className="w-10 font-mono text-foreground">{mix.originalVolume.toFixed(2)}</span>
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={mix.duck}
            disabled={!mix.keepOriginal}
            onChange={(e) => wf.setMix({ duck: e.target.checked })}
            className="accent-primary"
          />
          Duck the background under the new voice
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void wf.buildTrack()} disabled={busy}>
          <Layers className="mr-1.5 size-4" />
          {wf.generatedTrack ? "Rebuild final mix" : "Render final mix"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !wf.generatedTrack}
          onClick={() => void wf.renderVideo()}
        >
          <Film className="mr-1.5 size-4" />
          {wf.generatedVideo ? "Re-render final video" : "Render final video"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={busy || !wf.generatedTrack}>
              <Download className="mr-1.5 size-4" />
              Download final video
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
              Video + generated audio
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => void wf.downloadFinalVideo({ subtitles: false })}>
              Download without subtitles
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void wf.downloadFinalVideo({ subtitles: true })}>
              Download with {wf.subtitleLanguage} subtitles
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
          {(["generated", "original"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTrack(option)}
              disabled={option === "generated" ? !wf.generatedTrack : false}
              className={`rounded px-2 py-1 capitalize disabled:opacity-40 ${
                track === option ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showSubtitles}
            onChange={(e) => setShowSubtitles(e.target.checked)}
            className="accent-primary"
          />
          Subtitles
        </label>
      </div>

      <SyncedVideoPreview
        src={videoSrc}
        segments={segments}
        duration={duration}
        generatedUrl={wf.generatedTrack?.url ?? null}
        track={track}
        cues={wf.cues}
        showSubtitles={showSubtitles}
      />

      <Waveform
        peaks={track === "generated" ? (wf.generatedTrack?.peaks ?? []) : (wf.audio?.peaks ?? [])}
      />

      {!wf.generatedTrack ? (
        <p className="text-xs text-muted-foreground">
          Render the final mix to watch the video with the generated voice.
        </p>
      ) : null}

      {wf.generatedVideo ? (
        <div className="space-y-2 rounded-md border border-border p-3">
          <p className="text-xs text-muted-foreground">
            Final video — original picture, generated speech, one file (
            {(wf.generatedVideo.meta.size / 1_000_000).toFixed(1)} MB,{" "}
            {wf.generatedVideo.meta.language}, {wf.generatedVideo.meta.voiceLabel}).
          </p>
          <video src={wf.generatedVideo.url} controls className="w-full rounded-md" />
        </div>
      ) : null}
    </div>
  );
}
