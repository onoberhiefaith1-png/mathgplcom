// Slide player — full-screen presentation of a Canvas, shared by the Lesson
// Note and the Smartboard. It mounts at the top layer (a portal to <body>) so
// no panel or workspace chrome can ever clip it. No editing chrome: Next
// reveals the next step; after the last step it moves on to the next slide.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { SlideMedia } from "./SlideMedia";
import { SlideContentBlock } from "./SlideContentBlock";
import { listSlideItems, maxStep, SLIDE_PAGE, type Slide, type SlideItem } from "@/lib/lessonnotes/slides";

interface Props {
  slides: Slide[];
  startIndex?: number;
  onExit: () => void;
  /** Canvas name shown while presenting. */
  canvasName?: string;
  /** Dark presenting surface (Smartboard) vs light overlay (Lesson Note). */
  dark?: boolean;
}

export function SlidePlayer({ slides, startIndex = 0, onExit, canvasName, dark = false }: Props) {
  const [index, setIndex] = useState(startIndex);
  const [step, setStep] = useState(1);
  const [items, setItems] = useState<SlideItem[]>([]);
  const [scale, setScale] = useState(1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const slide = slides[index];

  useEffect(() => {
    let alive = true;
    if (!slide) return;
    listSlideItems(slide.id)
      .then((rows) => { if (alive) setItems(rows); })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [slide]);

  // Try real browser full-screen; the fixed overlay already covers the viewport
  // if the request is refused, so presenting never depends on it.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    void el.requestFullscreen?.({ navigationUI: "hide" }).catch(() => {});
    return () => {
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const fit = () => {
      const b = stage.getBoundingClientRect();
      if (!b.width || !b.height) return;
      setScale(Math.min(b.width / SLIDE_PAGE.w, b.height / SLIDE_PAGE.h));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);

  const total = useMemo(() => maxStep(items), [items]);
  const visible = items.filter((i) => i.step <= step);

  const next = useCallback(() => {
    if (step < total) { setStep((s) => s + 1); return; }
    if (index < slides.length - 1) { setIndex((i) => i + 1); setStep(1); }
  }, [step, total, index, slides.length]);

  const back = useCallback(() => {
    if (step > 1) { setStep((s) => s - 1); return; }
    if (index > 0) { setIndex((i) => i - 1); setStep(1); }
  }, [step, index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
      else if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, onExit]);

  if (!slide) return null;

  const body = (
    <div
      ref={rootRef}
      data-slide-chrome="true"
      className="fixed inset-0 z-[10000] bg-white"
    >
      {/* Chrome floats over the white surface so it never creates margins. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 px-4 py-2 text-xs text-slate-600">
        <span className="min-w-0 truncate font-semibold">
          {canvasName ? `${canvasName} — ${slide.name}` : slide.name}
        </span>
        <span className="shrink-0 tabular-nums">
          Slide {index + 1} of {slides.length}
          {total > 1 ? ` · Step ${step}/${total}` : ""}
        </span>
        <button
          type="button"
          onClick={onExit}
          className="pointer-events-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-900/10 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-900/20"
        >
          <X className="h-3.5 w-3.5" /> Exit Presentation
        </button>
      </div>

      <div ref={stageRef} className="absolute inset-0 overflow-hidden bg-white">
        <div
          className="absolute left-1/2 top-1/2 bg-white"
          style={{
            width: SLIDE_PAGE.w,
            height: SLIDE_PAGE.h,
            transform: `translate(-50%, -50%) scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          {visible.map((item) => (
            <div
              key={item.id}
              className="absolute"
              style={{
                left: `${item.x * 100}%`,
                top: `${item.y * 100}%`,
                width: `${item.w * 100}%`,
                height: `${item.h * 100}%`,
                zIndex: item.z + 1,
              }}
            >
              {item.kind === "content" ? (
                <SlideContentBlock nodes={item.content_json} />
              ) : (
                <SlideMedia item={item} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-3 pb-5">
        <button
          type="button"
          onClick={back}
          className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-slate-900/10 px-4 py-2 text-sm text-slate-700 hover:bg-slate-900/20"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>
        <button
          type="button"
          onClick={next}
          className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>

    </div>
  );

  return typeof document === "undefined" ? body : createPortal(body, document.body);
}
