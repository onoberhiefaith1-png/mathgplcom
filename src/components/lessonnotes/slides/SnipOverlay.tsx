// Snip overlay — the Windows-snipping-tool style area selector used by Slide.
// It sits over the Lesson Note sheet while the Slide panel is hidden, so the
// captured image never contains any Slide chrome.
import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, X } from "lucide-react";

export interface SnipResult {
  blob: Blob;
  /** Selection rectangle as fractions of the captured sheet (0..1). */
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Rect { left: number; top: number; width: number; height: number }

interface Props {
  /** The Lesson Note sheet element that gets rasterised. */
  sheetEl: HTMLElement | null;
  onCancel: () => void;
  onCapture: (result: SnipResult) => void;
}

export function SnipOverlay({ sheetEl, onCancel, onCapture }: Props) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [busy, setBusy] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);

  const handleDown = (e: React.PointerEvent) => {
    if (busy) return;
    start.current = { x: e.clientX, y: e.clientY };
    dragging.current = true;
    setRect({ left: e.clientX, top: e.clientY, width: 0, height: 0 });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!dragging.current || !start.current) return;
    const s = start.current;
    setRect({
      left: Math.min(s.x, e.clientX),
      top: Math.min(s.y, e.clientY),
      width: Math.abs(e.clientX - s.x),
      height: Math.abs(e.clientY - s.y),
    });
  };

  const handleUp = () => {
    dragging.current = false;
  };

  const capture = useCallback(async () => {
    if (!rect || !sheetEl || rect.width < 4 || rect.height < 4) return;
    setBusy(true);
    try {
      const { toCanvas } = await import("html-to-image");
      const sheetBox = sheetEl.getBoundingClientRect();
      const full = await toCanvas(sheetEl, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        filter: (node) =>
          !(node instanceof HTMLElement && node.dataset?.slideChrome === "true"),
      });
      const sx = full.width / sheetBox.width;
      const sy = full.height / sheetBox.height;
      const cropX = (rect.left - sheetBox.left) * sx;
      const cropY = (rect.top - sheetBox.top) * sy;
      const cropW = rect.width * sx;
      const cropH = rect.height * sy;

      const out = document.createElement("canvas");
      out.width = Math.max(1, Math.round(cropW));
      out.height = Math.max(1, Math.round(cropH));
      const ctx = out.getContext("2d");
      if (!ctx) throw new Error("canvas_unavailable");
      ctx.drawImage(full, cropX, cropY, cropW, cropH, 0, 0, out.width, out.height);
      const blob = await new Promise<Blob | null>((res) => out.toBlob(res, "image/png"));
      if (!blob) throw new Error("encode_failed");

      onCapture({
        blob,
        x: Math.max(0, Math.min(1, (rect.left - sheetBox.left) / sheetBox.width)),
        y: Math.max(0, Math.min(1, (rect.top - sheetBox.top) / sheetBox.height)),
        w: Math.max(0.02, Math.min(1, rect.width / sheetBox.width)),
        h: Math.max(0.02, Math.min(1, rect.height / sheetBox.height)),
      });
    } finally {
      setBusy(false);
    }
  }, [rect, sheetEl, onCapture]);

  const confirmable = !!rect && !dragging.current && rect.width > 4 && rect.height > 4;

  return createPortal(
    <div
      data-slide-chrome="true"
      className="fixed inset-0 z-[9999]"
      style={{ cursor: "crosshair", touchAction: "none" }}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
    >
      {/* Dim mask with the selection cut out, so the chosen area stays bright
          and everything else is subdued. */}
      <div
        className="absolute inset-0 bg-slate-900/45"
        style={
          rect
            ? {
                clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${rect.left}px ${rect.top}px, ${rect.left}px ${rect.top + rect.height}px, ${rect.left + rect.width}px ${rect.top + rect.height}px, ${rect.left + rect.width}px ${rect.top}px, ${rect.left}px ${rect.top}px)`,
              }
            : undefined
        }
      />

      {rect && (
        <div
          className="absolute border-2 border-white shadow-[0_0_0_1px_rgba(15,23,42,0.6)]"
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
        />
      )}

      {!rect && (
        <div className="absolute left-1/2 top-6 -translate-x-1/2 rounded-full bg-white/95 px-4 py-2 text-xs font-medium text-slate-700 shadow">
          Drag across the area you want to capture
        </div>
      )}

      <div
        className="absolute left-1/2 bottom-8 -translate-x-1/2 flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 shadow-lg"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          disabled={!confirmable || busy}
          onClick={capture}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
        >
          <Camera className="h-4 w-4" /> {busy ? "Capturing…" : "Screenshot"}
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
