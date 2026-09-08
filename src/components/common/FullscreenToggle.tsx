// Global fullscreen toggle — a small floating button in the top-right of
// every page. Uses the browser Fullscreen API on the document element so
// the whole app (lesson notes, smartboard, adventure, classes, etc.)
// expands to fill the physical screen. Click again to exit.

import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { useIsTouchLayout } from "@/hooks/useBreakpoint";

export function FullscreenToggle() {
  const [isFs, setIsFs] = useState(false);
  // Phones and tablets have no use for this control — and it competes with the
  // Smartboard top bar for space. Desktop keeps it.
  const touch = useIsTouchLayout();

  useEffect(() => {
    const fn = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fn);
    return () => document.removeEventListener("fullscreenchange", fn);
  }, []);

  const toggle = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* user gesture / unsupported — ignore silently */
    }
  };

  if (touch) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      title={isFs ? "Exit full screen" : "Full screen"}
      aria-label="Toggle full screen"
      className="fixed top-3 right-3 z-[9999] h-9 w-9 inline-flex items-center justify-center rounded-full border border-foreground/20 bg-background/70 text-foreground/80 backdrop-blur hover:bg-background hover:text-foreground shadow-md transition-colors"
    >
      {isFs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
    </button>
  );
}
