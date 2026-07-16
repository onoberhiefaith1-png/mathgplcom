// Selection frame + hover-only Edit chip. In Presentation Mode the orange
// outline and edit chip fade away entirely, leaving a clean lesson-ready
// diagram. Any mouse activity brings the chrome back.

import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  selected: boolean;
  onEdit?: () => void;
  children: ReactNode;
  /** When true, hide outline + chip (auto-hides after idle). */
  presenting?: boolean;
  /** Called on hover/pointer so the parent can reset the idle timer. */
  onActivity?: () => void;
  /** When true, frame is block-level and fills its parent's width. */
  block?: boolean;
}

export function SelectionFrame({ selected, onEdit, children, presenting = false, onActivity, block = false }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState(false);
  const [linger, setLinger] = useState(false);
  const [, force] = useState(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const showChrome = () => {
    clearHideTimer();
    setHover(true);
    setLinger(true);
    onActivity?.();
  };

  const scheduleHide = () => {
    setHover(false);
    setLinger(true);
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => setLinger(false), 10000);
  };

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(() => force(v => v + 1));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => clearHideTimer(), []);

  const chromeVisible = !presenting;
  const showChip = !!onEdit && chromeVisible && (hover || linger || selected);

  return (
    <div
      ref={ref}
      className={block ? "relative block w-full" : "relative inline-block"}
      data-selected={selected ? "true" : "false"}
      onMouseEnter={showChrome}
      onMouseLeave={scheduleHide}
      onMouseMove={() => { setLinger(true); onActivity?.(); }}
      onPointerDown={() => { setLinger(true); onActivity?.(); }}
      style={{ transition: "opacity 200ms" }}
    >

      {children}
      {showChip && (
        <button
          type="button"
          onMouseEnter={showChrome}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLinger(true); onEdit(); }}
          className="absolute -bottom-7 left-1/2 -translate-x-1/2 z-10 rounded-full bg-primary text-primary-foreground text-[10px] font-medium px-2.5 py-0.5 shadow-md hover:brightness-110 active:scale-95"
          style={{ lineHeight: 1.4 }}
        >
          ⚙ Edit
        </button>
      )}
    </div>
  );
}
