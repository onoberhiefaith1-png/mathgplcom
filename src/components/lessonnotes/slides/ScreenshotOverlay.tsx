// Screenshot crop step. The frame has already been grabbed from the chosen
// screen / window / tab, so the teacher now simply drags over it — or takes the
// whole surface. The current slide and canvas are untouched throughout: this is
// an overlay, nothing is created or reset until the teacher inserts.
import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Maximize2, X } from "lucide-react";
import { cropScreenFrame, type ScreenFrame } from "@/lib/lessonnotes/screenCapture";

interface Props {
  frame: ScreenFrame;
  onCancel: () => void;
  onInsert: (blob: Blob, aspect: number) => void;
}

interface Rect { left: number; top: number; width: number; height: number }

export function ScreenshotOverlay({ frame, onCancel, onInsert }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  const down = (e: React.PointerEvent) => {
    if (busy) return;
    start.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
    setRect({ left: e.clientX, top: e.clientY, width: 0, height: 0 });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent) => {
    if (!dragging || !start.current) return;
    const s = start.current;
    setRect({
      left: Math.min(s.x, e.clientX),
      top: Math.min(s.y, e.clientY),
      width: Math.abs(e.clientX - s.x),
      height: Math.abs(e.clientY - s.y),
    });
  };

  const insert = useCallback(
    async (area: { x: number; y: number; w: number; h: number }) => {
      setBusy(true);
      try {
        const blob = await cropScreenFrame(frame, area);
        onInsert(blob, (area.w * frame.width) / Math.max(1, area.h * frame.height));
      } finally {
        setBusy(false);
      }
    },
    [frame, onInsert],
  );

  const useSelection = () => {
    const img = imgRef.current;
    if (!img || !rect) return;
    const b = img.getBoundingClientRect();
    const x = (rect.left - b.left) / b.width;
    const y = (rect.top - b.top) / b.height;
    void insert({
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      w: Math.max(0.01, Math.min(1 - Math.max(0, x), rect.width / b.width)),
      h: Math.max(0.01, Math.min(1 - Math.max(0, y), rect.height / b.height)),
    });
  };

  const confirmable = !!rect && rect.width > 6 && rect.height > 6;

  return createPortal(
    <div data-slide-chrome="true" className="fixed inset-0 z-[9999] bg-slate-950/90">
      <div className="absolute inset-0 grid place-items-center p-6">
        <div className="relative max-h-full max-w-full" style={{ touchAction: "none" }}>
          <img
            ref={imgRef}
            src={frame.url}
            alt="Captured screen"
            draggable={false}
            className="max-h-[calc(100vh-8rem)] max-w-full select-none rounded shadow-2xl"
          />
          <div
            className="absolute inset-0"
            style={{ cursor: "crosshair" }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={() => setDragging(false)}
          >
            {rect && imgRef.current && (
              <div
                className="absolute border-2 border-white bg-white/10"
                style={{
                  left: rect.left - imgRef.current.getBoundingClientRect().left,
                  top: rect.top - imgRef.current.getBoundingClientRect().top,
                  width: rect.width,
                  height: rect.height,
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="absolute left-1/2 top-5 -translate-x-1/2 rounded-full bg-white/95 px-4 py-2 text-xs font-medium text-slate-700 shadow">
        {confirmable
          ? "Insert this selection, or take the whole screen"
          : "Drag over the area you want — or take the whole screen"}
      </div>

      <div
        className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/95 px-3 py-2 shadow-lg"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          disabled={!confirmable || busy}
          onClick={useSelection}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
        >
          <Camera className="h-4 w-4" /> {busy ? "Inserting…" : "Insert selection"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void insert({ x: 0, y: 0, w: 1, h: 1 })}
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
        >
          <Maximize2 className="h-4 w-4" /> Whole screen
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          <X className="h-4 w-4" /> Cancel
        </button>
      </div>
    </div>,
    document.body,
  );
}

export default ScreenshotOverlay;
