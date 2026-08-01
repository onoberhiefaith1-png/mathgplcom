import { useEffect, useState } from "react";

/**
 * One source of truth for device shape across the Student Account and the
 * public audience surfaces. Every feature exists on every device — only the
 * container changes.
 *
 *   phone   < 768px   → bottom tab bar + slide-up drawer
 *   tablet  < 1280px  → left navigation rail
 *   desktop >= 1280px → existing full desktop navigation
 */
export type Breakpoint = "phone" | "tablet" | "desktop";

export const PHONE_MAX = 767;
export const TABLET_MAX = 1279;

const read = (): Breakpoint => {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w <= PHONE_MAX) return "phone";
  if (w <= TABLET_MAX) return "tablet";
  return "desktop";
};

export function useBreakpoint(): Breakpoint {
  // SSR-safe: start at desktop, correct on the first client effect so a
  // device-dependent layout never hydration-mismatches.
  const [bp, setBp] = useState<Breakpoint>("desktop");

  useEffect(() => {
    const sync = () => setBp(read());
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);

  return bp;
}

/** True on phones and tablets — the touch-first layouts. */
export function useIsTouchLayout(): boolean {
  return useBreakpoint() !== "desktop";
}
