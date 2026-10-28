// Global fullscreen toggle — a small floating button on every page and every
// device. Uses the browser Fullscreen API on the document element so the
// whole app expands to fill the physical screen. Click again to exit.
// It is never hidden by screen size: smaller laptops (under 1280px wide)
// used to lose it entirely.

import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { useIsTouchLayout } from "@/hooks/useBreakpoint";

export function FullscreenToggle() {
  const [isFs, setIsFs] = useState(false);
  const [supported, setSupported] = useState(true);
  const touch = useIsTouchLayout();

  useEffect(() => {
    setSupported(!!document.documentElement.requestFullscreen);
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

  // iPhone Safari has no Fullscreen API for pages; a dead button helps no one.
  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      title={isFs ? "Exit full screen" : "Full screen"}
      aria-label="Toggle full screen"
      // Touch screens: bottom-right so it never covers the Smartboard top bar.
      className={`fixed ${touch ? "bottom-3 right-3" : "top-3 right-3"} z-[9999] h-9 w-9 inline-flex items-center justify-center rounded-full border border-foreground/20 bg-background/80 text-foreground/80 backdrop-blur hover:bg-background hover:text-foreground shadow-md transition-colors`}
    >
      {isFs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
    </button>
  );
}
