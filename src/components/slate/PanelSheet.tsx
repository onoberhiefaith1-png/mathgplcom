import { useRef, useState } from "react";

/**
 * PHONE CONTAINER for the Game board panels.
 *
 * On a phone the old panel covered 86% of the screen, so a teacher could not
 * see the surface they were styling and the top controls sat underneath it.
 * Here the panel becomes a bottom sheet: the board stays visible above it and
 * the sheet can be dragged taller or shorter with the grab bar.
 *
 * Desktop and tablet never use this component.
 */
export function PanelSheet({ children }: { children: React.ReactNode }) {
  const [heightVh, setHeightVh] = useState(58);
  const drag = useRef<{ y: number; start: number } | null>(null);

  const onPointerDown = (event: React.PointerEvent) => {
    drag.current = { y: event.clientY, start: heightVh };
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent) => {
    const state = drag.current;
    if (!state) return;
    const delta = ((state.y - event.clientY) / window.innerHeight) * 100;
    setHeightVh(Math.min(92, Math.max(28, state.start + delta)));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-2xl border-t border-amber-200/25 bg-[#120d07] shadow-[0_-12px_40px_rgba(0,0,0,0.6)]"
      style={{ height: `${heightVh}vh` }}
    >
      <div
        role="separator"
        aria-label="Drag to resize the panel"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="flex h-6 shrink-0 cursor-row-resize touch-none items-center justify-center"
      >
        <span className="h-1 w-10 rounded-full bg-amber-200/40" />
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
