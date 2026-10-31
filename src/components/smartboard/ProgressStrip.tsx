import { useEffect, useRef, type ReactNode } from "react";

/** A three-position viewport over every marker. Only active-index changes
 * recenter it: swiping to inspect earlier work never snaps back on a clock tick. */
export function ProgressStrip({ activeIndex, label, children }: {
  activeIndex: number; label: string; children: ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current;
    const current = el?.querySelector<HTMLElement>(`[data-progress-index="${activeIndex}"]`);
    if (!el || !current) return;
    const left = current.offsetLeft - el.offsetLeft - (el.clientWidth - current.offsetWidth) / 2;
    el.scrollTo?.({ left: Math.max(0, left), behavior: "smooth" });
  }, [activeIndex]);
  return <div ref={host} role="navigation" aria-label={label} title={`${label} — swipe to see all`}
    className="relative flex w-[92px] min-[390px]:w-[104px] shrink-0 items-center gap-1 overflow-x-auto overscroll-x-contain"
    style={{ scrollbarWidth: "none", touchAction: "pan-x", scrollSnapType: "x proximity" }}>
    {children}
  </div>;
}
