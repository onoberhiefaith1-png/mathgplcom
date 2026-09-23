// Phase 4 — say "Aura" anywhere in the platform and she answers. Rendered once,
// beside the cockpit, so the name works on every page.

import { useCallback, useEffect } from "react";
import { Ear } from "lucide-react";

import { useAura } from "@/lib/agent/AuraProvider";
import { cn } from "@/lib/utils";

import { useWakeWord } from "./useWakeWord";

export default function AuraWakeWord() {
  const { wakeEnabled, setWakeEnabled, setOpen, send, status, speaking } = useAura();

  const onWake = useCallback(
    (command: string) => {
      setOpen(true);
      if (command) send(command, { spoken: true });
    },
    [send, setOpen],
  );

  // Her own voice, and her working time, must not wake her again.
  const wake = useWakeWord({ onWake, paused: speaking || status === "submitted" });

  useEffect(() => {
    if (wakeEnabled && wake.supported) wake.start();
    else wake.stop();
  }, [wake, wakeEnabled]);

  useEffect(() => {
    if (wakeEnabled && !wake.supported) setWakeEnabled(false);
  }, [setWakeEnabled, wake.supported, wakeEnabled]);

  if (!wakeEnabled || !wake.armed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed bottom-20 right-5 z-[68] flex max-w-[16rem] items-center gap-2",
        "rounded-full border border-primary/40 bg-background/95 px-3 py-1.5 text-xs shadow-lg backdrop-blur",
      )}
    >
      <span className="relative flex size-2.5 shrink-0">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
        <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
      </span>
      <Ear className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate text-muted-foreground">
        {wake.heard ? wake.heard : 'Say "Aura"'}
      </span>
    </div>
  );
}
