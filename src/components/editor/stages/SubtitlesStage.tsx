import { Download, Languages, Subtitles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTimecode } from "@/lib/editor/types";
import type { WorkflowApi } from "@/lib/editor/useWorkflow";
import { LanguagePicker } from "../LanguagePicker";

export function SubtitlesStage({ wf, onSeek }: { wf: WorkflowApi; onSeek: (t: number) => void }) {
  if (wf.cues.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Subtitles are built from the approved script and its timings — complete Stage 3 first.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <LanguagePicker
          label="Subtitle language"
          value={wf.subtitleLanguage}
          onChange={wf.setSubtitleLanguage}
        />
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <Languages className="size-3.5" />
          <span className="flex-1">
            Captions are shown in {wf.subtitleLanguage}. The spoken track is not affected.
            {wf.subtitlePendingIds.length > 0
              ? ` ${wf.subtitlePendingIds.length} caption(s) still need translating.`
              : ""}
          </span>
          {wf.subtitlePendingIds.length > 0 ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              disabled={wf.busy === 8}
              onClick={() => void wf.runSubtitleTranslation()}
            >
              {wf.busy === 8 ? "Translating…" : `Translate captions to ${wf.subtitleLanguage}`}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">
          Characters per line
          <input
            type="number"
            min={20}
            max={80}
            value={wf.state.subtitles.maxCharsPerLine}
            onChange={(e) => wf.setSubtitles({ maxCharsPerLine: Number(e.target.value) || 42 })}
            className="mt-1 block h-9 w-24 rounded-md border border-input bg-background px-2 text-sm"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Max lines
          <input
            type="number"
            min={1}
            max={3}
            value={wf.state.subtitles.maxLines}
            onChange={(e) => wf.setSubtitles({ maxLines: Number(e.target.value) || 2 })}
            className="mt-1 block h-9 w-20 rounded-md border border-input bg-background px-2 text-sm"
          />
        </label>
        <Button size="sm" variant="outline" onClick={() => wf.exportSubtitles("srt")}>
          <Download className="mr-1.5 size-4" />
          .srt
        </Button>
        <Button size="sm" variant="outline" onClick={() => wf.exportSubtitles("vtt")}>
          <Download className="mr-1.5 size-4" />
          .vtt
        </Button>
        <span className="text-xs text-muted-foreground">
          <Subtitles className="mr-1 inline size-3.5" />
          {wf.cues.length} cues
        </span>
      </div>

      <ul className="max-h-[380px] space-y-1.5 overflow-y-auto pr-1">
        {wf.cues.map((cue, i) => (
          <li key={i} className="rounded-md border border-border p-2 text-sm">
            <button
              type="button"
              onClick={() => onSeek(cue.start)}
              className="font-mono text-[11px] text-primary hover:underline"
            >
              {formatTimecode(cue.start)} – {formatTimecode(cue.end)}
            </button>
            {cue.lines.map((line, j) => (
              <p key={j}>{line}</p>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
