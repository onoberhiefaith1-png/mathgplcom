// Phase 3 — the way in: a quiet floating mark that opens the cockpit from any
// page, and a keyboard shortcut for teachers who live on the keyboard.

import { useEffect } from "react";

import auraMark from "@/assets/aura-mark.png";
import { useAura } from "@/lib/agent/AuraProvider";

export default function AuraLauncher() {
  const { open, toggle } = useAura();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  if (open) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Open Aura, your teaching assistant"
      className="fixed bottom-5 right-5 z-[69] flex items-center gap-2 rounded-full border border-border bg-background/95 py-1.5 pl-1.5 pr-3 shadow-lg backdrop-blur transition hover:shadow-xl"
    >
      <img src={auraMark} alt="" width={32} height={32} loading="lazy" className="size-8 rounded-full" />
      <span className="text-sm font-medium">Ask Aura</span>
    </button>
  );
}
