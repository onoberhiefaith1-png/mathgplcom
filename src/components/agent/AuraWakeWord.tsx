// Say "Aura" anywhere in the platform and this is the proof she heard you: the
// badge switches from a quiet ear to a live sound wave with the words she picks up.

import { Ear } from "lucide-react";

import { useAura } from "@/lib/agent/AuraProvider";
import { cn } from "@/lib/utils";

import AuraWaveform from "./AuraWaveform";

export default function AuraWakeWord() {
  const { wakeEnabled, listening, open } = useAura();
  const capturing = listening.mode === "capture";

  // While the cockpit is open it shows its own wave; this badge is for the rest
  // of the platform.
  if (open) return null;
  if (!wakeEnabled || listening.mode === "off") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed bottom-20 right-5 z-[68] flex max-w-[18rem] items-center gap-2",
        "rounded-full border bg-background/95 px-3 py-1.5 text-xs shadow-lg backdrop-blur",
        capturing ? "border-primary" : "border-primary/40",
      )}
    >
      {capturing ? (
        <AuraWaveform level={listening.level} className="w-20 shrink-0" height={18} />
      ) : (
        <>
          <span className="relative flex size-2.5 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
          </span>
          <Ear className="size-3.5 shrink-0 text-muted-foreground" />
        </>
      )}
      <span className="truncate text-muted-foreground">
        {capturing ? listening.transcript || "I'm listening…" : 'Say "Aura"'}
      </span>
    </div>
  );
}
