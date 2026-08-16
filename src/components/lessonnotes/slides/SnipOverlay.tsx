// Capture overlay — the teacher highlights an area of the lesson note and
// presses Capture. Whenever a valid area exists the Capture button is active,
// so it can never "not appear". Note content is captured as live, editable
// mathematics; only when the area holds no note nodes does it fall back to a
// rasterised image.
import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, X } from "lucide-react";
import type { Editor } from "@tiptap/react";
import { captureNoteSelection, type CapturedContent } from "@/lib/lessonnotes/noteCapture";

export interface SnipResult {
  /** Live note nodes, when the selection covered note content. */
  content?: unknown[];
  /** Rasterised fallback. */
  blob?: Blob;
  /** Selection rectangle as fractions of the captured sheet (0..1). */
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Rect { left: number; top: number; width: number; height: number }

interface Props {
  /** The Lesson Note sheet element the capture is taken from. */
  sheetEl: HTMLElement | null;
  /** The live note editor — its nodes are what gets captured. */
  editor?: Editor | null;
  onCancel: () => void;
  onCapture: (result: SnipResult) => void;
}

export function SnipOverlay({ sheetEl, editor = null, onCancel, onCapture }: Props) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  const handleDown = (e: React.PointerEvent) => {
    if (busy) return;
    start.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
    setRect({ left: e.clientX, top: e.clientY, width: 0, height: 0 });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!dragging || !start.current) return;
    const s = start.current;
    setRect({
      left: Math.min(s.x, e.clientX),
      top: Math.min(s.y, e.clientY),
      width: Math.abs(e.clientX - s.x),
      height: Math.abs(e.clientY - s.y),
    });
  };

  const handleUp = () => setDragging(false);

  const rasterise = useCallback(
    async (r: Rect): Promise<SnipResult | null> => {
      if (!sheetEl) return null;
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
      const out = document.createElement("canvas");
      out.width = Math.max(1, Math.round(r.width * sx));
      out.height = Math.max(1, Math.round(r.height * sy));
      const ctx = out.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(
        full,
        (r.left - sheetBox.left) * sx,
        (r.top - sheetBox.top) * sy,
        r.width * sx,
        r.height * sy,
        0, 0, out.width, out.height,
      );
      const blob = await new Promise<Blob | null>((res) => out.toBlob(res, "image/png"));
      if (!blob) return null;
      return {
        blob,
        x: Math.max(0, Math.min(1, (r.left - sheetBox.left) / sheetBox.width)),
        y: Math.max(0, Math.min(1, (r.top - sheetBox.top) / sheetBox.height)),
        w: Math.max(0.02, Math.min(1, r.width / sheetBox.width)),
        h: Math.max(0.02, Math.min(1, r.height / sheetBox.height)),
      };
    },
    [sheetEl],
  );

  const capture = useCallback(async () => {
    if (!rect || rect.width < 4 || rect.height < 4) return;
    setBusy(true);
    try {
      const live: CapturedContent | null = captureNoteSelection(editor, sheetEl, rect);
      if (live) {
        onCapture({ content: live.nodes, x: live.x, y: live.y, w: live.w, h: live.h });
        return;
      }
      const raster = await rasterise(rect);
      if (raster) onCapture(raster);
    } finally {
      setBusy(false);
    }
  }, [rect, editor, sheetEl, rasterise, onCapture]);

  const confirmable = !!rect && rect.width > 4 && rect.height > 4;

  return createPortal(
    <div
      data-slide-chrome="true"
      className="fixed inset-0 z-[9999]"
      style={{ cursor: "crosshair", touchAction: "none" }}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
    >
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

      <div className="absolute left-1/2 top-6 -translate-x-1/2 rounded-full bg-white/95 px-4 py-2 text-xs font-medium text-slate-700 shadow">
        {confirmable
          ? "Press Capture to turn this area into a slide"
          : "Highlight the area you want to capture"}
      </div>

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
          <Camera className="h-4 w-4" /> {busy ? "Capturing…" : "Capture"}
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
