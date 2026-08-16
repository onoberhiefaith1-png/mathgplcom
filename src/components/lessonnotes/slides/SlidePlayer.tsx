// Slide player — shared by the Lesson Note Preview and the Smartboard.
// Next reveals the next step of the current Slide; after the last step it
// moves on to the next Slide.
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { SlideMedia } from "./SlideMedia";
import { listSlideItems, maxStep, type Slide, type SlideItem } from "@/lib/lessonnotes/slides";

interface Props {
  slides: Slide[];
  startIndex?: number;
  onExit: () => void;
  /** Dark presenting surface (Smartboard) vs light overlay (Lesson Note). */
  dark?: boolean;
}

export function SlidePlayer({ slides, startIndex = 0, onExit, dark = false }: Props) {
  const [index, setIndex] = useState(startIndex);
  const [step, setStep] = useState(1);
  const [items, setItems] = useState<SlideItem[]>([]);
  const slide = slides[index];

  useEffect(() => {
    let alive = true;
    if (!slide) return;
    listSlideItems(slide.id)
      .then((rows) => { if (alive) setItems(rows); })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [slide]);

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

  return (
    <div
      data-slide-chrome="true"
      className={dark ? "absolute inset-0 z-50 flex flex-col bg-slate-950" : "absolute inset-0 z-50 flex flex-col bg-slate-900/80"}
    >
      <div className="flex items-center justify-between px-4 py-2 text-xs text-white/80">
        <span className="font-semibold">{slide.name}</span>
        <span className="tabular-nums">
          Slide {index + 1}/{slides.length} · Step {step}/{total}
        </span>
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 hover:bg-white/25"
        >
          <X className="h-3.5 w-3.5" /> Exit
        </button>
      </div>

      <div className="flex-1 min-h-0 p-4">
        <div className="relative mx-auto h-full w-full max-w-[1400px] overflow-hidden rounded-lg bg-white">
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
              <SlideMedia item={item} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 pb-5">
        <button
          type="button"
          onClick={back}
          className="inline-flex items-center gap-1 rounded-full bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/25"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <button
          type="button"
          onClick={next}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
