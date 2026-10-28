import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LanguagePicker } from "../LanguagePicker";
import { formatTimecode } from "@/lib/editor/types";
import type { WorkflowApi } from "@/lib/editor/useWorkflow";

export function LanguageStage({ wf }: { wf: WorkflowApi }) {
  const busy = wf.busy === 5;
  const translation = new Map(wf.state.translation.map((t) => [t.id, t]));
  const stale = wf.translationStaleIds;

  if (wf.state.transcript.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Translation works from the approved script — finish Stage 3 and Stage 4 first.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Each segment is translated on its own and keeps its timing window, so one failure never
        blocks the rest. Leave the language as English to keep the lesson in its original language.
      </p>
      <LanguagePicker
        value={wf.state.targetLanguage}
        onChange={wf.setTargetLanguage}
        label="Target language"
      />
      <div className="flex flex-wrap items-end gap-2">
        <Button size="sm" onClick={() => void wf.runTranslation()} disabled={busy}>
          <Languages className="mr-1.5 size-4" />
          {wf.state.translation.length ? "Retranslate everything" : "Translate script"}
        </Button>
        {stale.length > 0 && wf.state.translation.length > 0 ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void wf.runTranslation(stale)}>
            Update {stale.length} changed
          </Button>
        ) : null}
      </div>

      <ul className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
        {wf.state.transcript.map((segment) => {
          const translated = translation.get(segment.id);
          const status = wf.translationStatus[segment.id];
          const isStale = stale.includes(segment.id);
          const source =
            wf.state.paraphrase.find((p) => p.id === segment.id)?.text ?? segment.text;
          return (
            <li key={segment.id} className="rounded-md border border-border p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {formatTimecode(segment.start, false)} → {formatTimecode(segment.end, false)}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {wf.state.targetLanguage}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{source}</p>
              <Textarea
                value={translated?.text ?? ""}
                placeholder="Not translated yet"
                onChange={(e) => wf.editTranslation(segment.id, e.target.value)}
                className="mt-1 min-h-[56px] resize-y text-sm"
              />
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={translated ? "outline" : "default"}
                  className="h-7 text-[11px]"
                  disabled={status?.state === "generating"}
                  onClick={() => void wf.runTranslation([segment.id])}
                >
                  {status?.state === "generating"
                    ? "Translating…"
                    : translated
                      ? "Regenerate"
                      : "Translate"}
                </Button>
                {isStale && translated ? (
                  <span className="text-[10px] text-destructive">Out of date</span>
                ) : null}
                {status?.state === "error" ? (
                  <span className="text-[10px] text-destructive">{status.error}</span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
