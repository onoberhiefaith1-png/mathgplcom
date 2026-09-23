// What Aura's ears are actually doing, in plain rows. Opened from a small
// toggle under the input bar when voice misbehaves.

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ListeningEngine } from "./useListening";
import { SPEAKING_LEVEL } from "./recognizeStream";

type Props = {
  listening: ListeningEngine;
  /** Permission as the page understands it. */
  permission: string;
  /** True while Aura is speaking. */
  speaking: boolean;
  className?: string;
};

function Row({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "min-w-0 truncate text-right font-mono",
          tone === "good" && "text-primary",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function VoiceDiagnostics({ listening, permission, speaking, className }: Props) {
  const [open, setOpen] = useState(false);
  const segment = listening.lastSegment;
  const loud = listening.level >= SPEAKING_LEVEL;

  return (
    <div className={className}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground"
        onClick={() => setOpen((was) => !was)}
      >
        Voice check
        {open ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
      </Button>

      {open ? (
        <div className="mt-1 rounded-lg border bg-muted/40 px-3 py-2 text-[11px]">
          <Row
            label="Microphone"
            value={permission === "granted" ? "connected" : "not connected"}
            tone={permission === "granted" ? "good" : "bad"}
          />
          <Row label="Permission" value={permission} />
          <Row label="Listening" value={listening.mode} />
          <Row label="Ear" value={listening.ear} />
          <Row
            label="Loudness"
            value={`${listening.level.toFixed(2)}${loud ? " (speech)" : " (quiet)"}`}
            tone={loud ? "good" : undefined}
          />
          <Row label="Aura speaking" value={speaking ? "yes" : "no"} />
          <Row
            label="Last recording"
            value={segment ? `${(segment.recordedMs / 1000).toFixed(1)}s, cut on ${segment.reason}` : "—"}
          />
          <Row
            label="Transcribed in"
            value={segment ? `${segment.roundTripMs} ms` : "—"}
            tone={segment && segment.roundTripMs > 2500 ? "bad" : undefined}
          />
          <Row label="Heard" value={segment?.heard || "—"} />
          <Row label="Final transcript" value={listening.transcript || "—"} />
          <Row
            label="Error"
            value={listening.hearingError ?? listening.errorMessage ?? "none"}
            tone={listening.hearingError || listening.errorMessage ? "bad" : "good"}
          />
        </div>
      ) : null}
    </div>
  );
}
