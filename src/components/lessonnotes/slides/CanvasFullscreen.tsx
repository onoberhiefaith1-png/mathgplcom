// Full-screen picture view for the Smartboard. The Canvas frame is skipped:
// the slide's picture/video fills the whole screen at its own shape, and the
// teacher zooms (50–500%) and drags it freely. Nothing is saved back.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { SlideMedia } from "./SlideMedia";
import { SlideStage } from "./SlideStage";
import { SlideContentBlock } from "./SlideContentBlock";
import { DiagramZoomControl } from "../geometry-editor/DiagramZoomControl";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { useHoverIdleVisibility } from "@/hooks/useHoverIdleVisibility";
import { clampVisualZoom } from "@/lib/visualTransform";
import { listSlideItems, SLIDE_PAGE, type Slide, type SlideItem } from "@/lib/lessonnotes/slides";

interface Props {
  slides: Slide[];
  startIndex: number;
  onClose: (lastIndex: number) => void;
}

export function CanvasFullscreen({ slides, startIndex, onClose }: Props) {
  const [index, setIndex] = useState(startIndex);
  const [items, setItems] = useState<SlideItem[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [fit, setFit] = useState(1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const enteredNativeFullscreen = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const { visible, bind, ping } = useHoverIdleVisibility({ idleMs: 10000, hideWhileInside: true });
  const slide = slides[index];

  const close = useCallback(() => onClose(index), [onClose, index]);
  useEscapeClose(close);

  useEffect(() => {
    let alive = true;
    setZoom(1); setPan({ x: 0, y: 0 });
    if (!slide) return;
    listSlideItems(slide.id).then((r) => { if (alive) setItems(r); }).catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [slide]);

  useEffect(() => {
    const el = rootRef.current;
    // The Smartboard may already own the browser's native full-screen layer.
    // In that case this view is portalled inside it (below) and must not try to
    // replace it. A body portal is invisible while another element is in the
    // browser top layer — that was why clicking Full screen appeared to do
    // nothing on the Smartboard.
    if (!document.fullscreenElement && el?.requestFullscreen) {
      void el.requestFullscreen({ navigationUI: "hide" })
        .then(() => { enteredNativeFullscreen.current = true; })
        .catch(() => {});
    }
    const onResize = () => setFit(Math.min(window.innerWidth / SLIDE_PAGE.w, window.innerHeight / SLIDE_PAGE.h));
    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (enteredNativeFullscreen.current && document.fullscreenElement === el) {
        void document.exitFullscreen?.().catch(() => {});
      }
    };
  }, []);

  // Leaving browser full screen (e.g. system Esc) also closes the view.
  useEffect(() => {
    const fn = () => {
      if (enteredNativeFullscreen.current && !document.fullscreenElement) close();
    };
    document.addEventListener("fullscreenchange", fn);
    return () => document.removeEventListener("fullscreenchange", fn);
  }, [close]);

  const next = useCallback(() => { setIndex((i) => Math.min(slides.length - 1, i + 1)); ping(); }, [slides.length, ping]);
  const back = useCallback(() => { setIndex((i) => Math.max(0, i - 1)); ping(); }, [ping]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back]);

  const media = items.filter((i) => i.kind !== "content");
  const main = media[media.length - 1];

  const onPointerDown = (e: React.PointerEvent) => {
    ping();
    if ((e.target as HTMLElement).closest("button,video")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      setZoom(clampVisualZoom(pinch.current.zoom * (d / pinch.current.dist)));
    } else if (pointers.current.size === 1) {
      setPan((p) => ({ x: p.x + e.clientX - prev.x, y: p.y + e.clientY - prev.y }));
    }
    ping();
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const round = "pointer-events-auto grid h-14 w-14 place-items-center rounded-full bg-background/80 text-foreground shadow-lg backdrop-blur hover:bg-background disabled:opacity-25";
  const fade = `transition-opacity ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`;

  const body = (
    <div
      ref={rootRef}
      data-canvas-fullscreen="true"
      className="fixed inset-0 z-[10000] touch-none select-none overflow-hidden bg-foreground"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={(e) => { setZoom((z) => clampVisualZoom(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1))); ping(); }}
      onPointerEnter={bind.onPointerEnter}
      onPointerLeave={bind.onPointerLeave}
    >
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "center" }}
      >
        {main ? (
          <div className="h-full w-full">
            <SlideMedia item={{ ...main, zoom: 1 }} />
          </div>
        ) : (
          <SlideStage
            items={items}
            className="bg-background"
            style={{ transform: `scale(${fit})`, transformOrigin: "center" }}
            renderItem={(item) => item.kind === "content"
              ? <SlideContentBlock nodes={item.content_json} />
              : <SlideMedia item={item} />}
          />
        )}
      </div>

      <div className={`pointer-events-none absolute inset-0 ${fade}`}>
        <button type="button" aria-label="Close full screen" onClick={close}
          className="pointer-events-auto absolute right-4 top-4 grid h-12 w-12 place-items-center rounded-full bg-background/80 text-foreground shadow-lg hover:bg-background">
          <X className="h-6 w-6" />
        </button>
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          <button type="button" aria-label="Previous slide" onClick={back} disabled={index === 0} className={round}>
            <ChevronLeft className="h-7 w-7" />
          </button>
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <button type="button" aria-label="Next slide" onClick={next} disabled={index >= slides.length - 1} className={round}>
            <ChevronRight className="h-7 w-7" />
          </button>
        </div>
        <div className="pointer-events-auto absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3">
          <DiagramZoomControl zoom={zoom} onZoom={(z) => { setZoom(clampVisualZoom(z)); if (clampVisualZoom(z) === 1) setPan({ x: 0, y: 0 }); ping(); }} />
          <span className="rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-foreground tabular-nums">
            {index + 1} / {slides.length}
          </span>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return body;
  // When the Smartboard is already in native full screen, only descendants of
  // that element are visible. Mount the picture view there instead of on body.
  const portalTarget = document.fullscreenElement ?? document.body;
  return createPortal(body, portalTarget);
}

export default CanvasFullscreen;
