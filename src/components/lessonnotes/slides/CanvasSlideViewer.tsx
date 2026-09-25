// ONE inline Canvas viewer — used by the lesson note, by the Smartboard and by
// any read-only surface. It shows EXACTLY ONE slide at a time inside the region
// the teacher gave the Canvas, with a chevron on each side. Clicking Next walks
// the slides in place, so a Venn diagram built across six slides feels drawn by
// hand.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { CanvasFullscreen } from "./CanvasFullscreen";
import { useSmartboardRoot } from "@/components/smartboard/SmartboardRoot";
import { DiagramZoomControl } from "../geometry-editor/DiagramZoomControl";
import { useHoverIdleVisibility } from "@/hooks/useHoverIdleVisibility";
import { clampBoundedOffset, clampVisualZoom } from "@/lib/visualTransform";
import { SlideStage } from "./SlideStage";
import { SlideMedia } from "./SlideMedia";
import { SlideContentBlock } from "./SlideContentBlock";
import {
  listCanvasSlides, listSlideItems, maxStep, SLIDE_PAGE,
  type Slide, type SlideItem,
} from "@/lib/lessonnotes/slides";

interface Props {
  canvasId: string;
  /** Shown while nothing has loaded yet. */
  canvasName?: string;
  /** Share of the available width the Canvas occupies (0.3 – 1). */
  scale?: number;
  /** Larger chrome for the Smartboard. */
  presentation?: boolean;
  /** Saved transform of the whole presentation in the Lesson Note. */
  authoredZoom?: number;
  authoredOffsetX?: number;
  authoredOffsetY?: number;
  /** Selection wakes the controls; inactivity still hides them after 10 seconds. */
  active?: boolean;
  /** Present only in the Lesson Note editor. Smartboard adjustments stay local. */
  onTransformChange?: (next: { zoom?: number; offsetX?: number; offsetY?: number }) => void;
}

export const clampCanvasScale = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0.3, n));
};

export function CanvasSlideViewer({
  canvasId,
  canvasName,
  scale = 1,
  presentation = false,
  authoredZoom = 1,
  authoredOffsetX = 0,
  authoredOffsetY = 0,
  active = false,
  onTransformChange,
}: Props) {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(1);
  const [items, setItems] = useState<SlideItem[]>([]);
  const [fit, setFit] = useState(0.5);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [boardZoom, setBoardZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const smartboardRoot = useSmartboardRoot();
  const enteredFsRef = useRef(false);
  const [boardOffset, setBoardOffset] = useState({ x: 0, y: 0 });
  const { visible: controlsVisible, bind, ping } = useHoverIdleVisibility({ idleMs: 10000, hideWhileInside: true });
  const savedZoom = clampVisualZoom(authoredZoom);
  const visualZoom = presentation ? clampVisualZoom(savedZoom * boardZoom) : savedZoom;
  const offsetX = (Number(authoredOffsetX) || 0) + (presentation ? boardOffset.x : 0);
  const offsetY = clampBoundedOffset((Number(authoredOffsetY) || 0) + (presentation ? boardOffset.y : 0), 0, 160);

  useEffect(() => { if (active) ping(); }, [active, ping]);

  useEffect(() => {
    let alive = true;
    setIndex(0);
    listCanvasSlides(canvasId)
      .then((rows) => { if (alive) setSlides(rows); })
      .catch(() => { if (alive) setSlides([]); });
    return () => { alive = false; };
  }, [canvasId]);

  const slide = slides[index] ?? null;

  useEffect(() => {
    let alive = true;
    setStep(1);
    if (!slide) { setItems([]); return; }
    listSlideItems(slide.id)
      .then((rows) => { if (alive) setItems(rows); })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [slide]);

  // The stage is a fixed 1600x900 coordinate space; it is scaled down to the
  // width this Canvas was given inside the note. The measurement is retried on
  // the next frames because a TipTap node view can mount before layout.
  useEffect(() => {
    let raf = 0;
    let tries = 0;
    const measure = () => {
      const el = boxRef.current;
      const w = el?.getBoundingClientRect().width ?? 0;
      if (w > 0) { setFit(w / SLIDE_PAGE.w); return; }
      if (tries++ < 30) raf = requestAnimationFrame(measure);
    };
    measure();
    const el = boxRef.current;
    const ro = el ? new ResizeObserver(measure) : null;
    if (el && ro) ro.observe(el);
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); };
  }, [slides.length, index]);

  const steps = useMemo(() => maxStep(items), [items]);
  const visible = items.filter((i) => i.step <= step);

  const atStart = index === 0 && step === 1;
  const atEnd = index >= slides.length - 1 && step >= steps;

  const next = useCallback(() => {
    if (step < steps) { setStep((s) => s + 1); return; }
    if (index < slides.length - 1) { setIndex((i) => i + 1); }
  }, [step, steps, index, slides.length]);

  const back = useCallback(() => {
    if (step > 1) { setStep((s) => s - 1); return; }
    if (index > 0) setIndex((i) => i - 1);
  }, [step, index]);

  const width = `${Math.round(clampCanvasScale(scale) * visualZoom * 100)}%`;
  const btn = presentation ? "h-12 w-12" : "h-9 w-9";
  const icon = presentation ? "h-6 w-6" : "h-4 w-4";
  const chev = `pointer-events-auto grid shrink-0 place-items-center rounded-full border border-border bg-background/90 text-foreground shadow-md transition hover:bg-muted disabled:opacity-25 ${btn} print:hidden`;

  return (
    <div
      ref={hostRef}
      contentEditable={false}
      data-canvas-embed={canvasId}
      className="relative my-3 w-full select-none print:my-2"
      style={{ paddingTop: offsetY, paddingBottom: offsetY > 0 ? 1 : 0 }}
      {...bind}
    >
      {/* PICTURE — may grow past the note width; the track crops it so the page
          never widens, and the controls above are never pushed off screen. */}
      <div className="w-full overflow-hidden">
        <div
          className="relative"
          style={{ width, transform: `translateX(${offsetX}px)` }}
          onPointerDown={(e) => {
            bind.onPointerDown();
            if ((e.target as HTMLElement).closest("button,video")) return;
            e.preventDefault();
            const host = hostRef.current;
            if (!host) return;
            const startX = e.clientX;
            const startY = e.clientY;
            const baseX = offsetX;
            const baseY = offsetY;
            const baseWidth = host.clientWidth * clampCanvasScale(scale);
            // Movement keeps a recoverable portion inside the document. Zoom is
            // deliberately excluded: resizing may exceed this movement boundary.
            const minX = -baseWidth * 0.2;
            const maxX = Math.max(0, host.clientWidth - baseWidth * 0.2);
            let nextX = baseX;
            let nextY = baseY;
            const onMove = (ev: PointerEvent) => {
              nextX = clampBoundedOffset(baseX + ev.clientX - startX, minX, maxX);
              nextY = clampBoundedOffset(baseY + ev.clientY - startY, 0, 160);
              if (presentation) setBoardOffset({ x: nextX - (Number(authoredOffsetX) || 0), y: nextY - (Number(authoredOffsetY) || 0) });
              else onTransformChange?.({ offsetX: nextX, offsetY: nextY });
              ping();
            };
            const onUp = () => {
              window.removeEventListener("pointermove", onMove);
              window.removeEventListener("pointerup", onUp);
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
          }}
        >
          <div ref={boxRef} className="w-full overflow-hidden rounded-lg border bg-white">
            <div style={{ height: SLIDE_PAGE.h * fit }} className="relative w-full">
              <SlideStage
                items={visible}
                className="absolute left-0 top-0"
                style={{ transform: `scale(${fit})`, transformOrigin: "top left" }}
                renderItem={(item) => item.kind === "content"
                  ? <SlideContentBlock nodes={item.content_json} />
                  : <SlideMedia item={item} />}
              />
            </div>
          </div>
        </div>
      </div>

      {/* CONTROL LAYER — pinned to the note width, never to the zoomed picture,
          so Next and the zoom badge stay in one reachable place at any size. */}
      <div
        className="pointer-events-none absolute inset-0 z-20 print:hidden"
        style={{ top: offsetY }}
      >
        {/* Sticky columns: on a tall (zoomed) Canvas the arrows and the zoom
            badge stay in view while the teacher scrolls, instead of sitting far
            below the fold. */}
        <div className="absolute inset-y-0 left-0 flex w-11 justify-start">
          <button
            type="button"
            onClick={back}
            disabled={atStart}
            aria-label="Previous slide"
            className={`sticky top-[45vh] ${chev}`}
          >
            <ChevronLeft className={icon} />
          </button>
        </div>
        <div className="absolute inset-y-0 right-0 flex w-11 justify-end">
          <button
            type="button"
            onClick={next}
            disabled={atEnd}
            aria-label="Next slide"
            className={`sticky top-[45vh] ${chev}`}
          >
            <ChevronRight className={icon} />
          </button>
        </div>

        {presentation && slides.length > 0 && (
          <div className="absolute inset-y-0 left-12 flex w-auto justify-start">
            <button
              type="button"
              // The board listens for pointer presses to draw/drag; keep this
              // press for the button so the click always arrives.
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                // Ask for full screen inside the click itself — browsers refuse
                // requests made later (after React re-renders).
                const owner = (smartboardRoot ?? document.documentElement) as HTMLElement;
                if (!document.fullscreenElement && owner.requestFullscreen) {
                  enteredFsRef.current = true;
                  void owner.requestFullscreen({ navigationUI: "hide" }).catch(() => { enteredFsRef.current = false; });
                }
                setFullscreen(true);
              }}
              aria-label="Full screen"
              className="pointer-events-auto sticky top-2 inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-background/90 px-3 text-sm font-medium text-foreground shadow-md hover:bg-muted"
            >
              <Maximize2 className="h-4 w-4" /> Full screen
            </button>
          </div>
        )}
        <div className="absolute inset-y-0 right-12 flex w-auto justify-end">
          <div
            className={`pointer-events-auto sticky top-2 h-fit transition-opacity ${controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}
          >
            <DiagramZoomControl
              zoom={presentation ? boardZoom : savedZoom}
              onZoom={(nextZoom) => {
                if (presentation) setBoardZoom(clampVisualZoom(nextZoom));
                else onTransformChange?.({ zoom: clampVisualZoom(nextZoom) });
                ping();
              }}
              compact={!presentation}
            />
          </div>
        </div>
      </div>

      <div className="mt-1 pl-11 text-[11px] text-muted-foreground print:hidden">
        {slides.length
          ? `${canvasName ? `${canvasName} · ` : ""}Slide ${index + 1} of ${slides.length}${steps > 1 ? ` · Step ${step}/${steps}` : ""}`
          : `${canvasName ?? "Canvas"} — no slides yet`}
      </div>
      {fullscreen && (
        <CanvasFullscreen
          slides={slides}
          startIndex={index}
          onClose={(last) => {
            setFullscreen(false);
            if (last !== index) setIndex(last);
            if (enteredFsRef.current && document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
            enteredFsRef.current = false;
          }}
        />
      )}
    </div>
  );
}

export default CanvasSlideViewer;
