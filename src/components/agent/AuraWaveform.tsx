// The moving sound wave: proof that Aura is really hearing the teacher's voice.

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

const BARS = 13;
/** Centre bars react most, so the wave swells from the middle like a voice note. */
const WEIGHTS = Array.from({ length: BARS }, (_, index) => {
  const distance = Math.abs(index - (BARS - 1) / 2) / ((BARS - 1) / 2);
  return 0.35 + 0.65 * (1 - distance * distance);
});

export default function AuraWaveform({
  level,
  className,
  height = 24,
}: {
  level: number;
  className?: string;
  height?: number;
}) {
  const bars = useRef<Array<HTMLSpanElement | null>>([]);
  const target = useRef(level);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    target.current = level;
  }, [level]);

  // Animated outside React so the wave stays smooth while Aura works.
  useEffect(() => {
    const tick = () => {
      const now = target.current;
      bars.current.forEach((bar, index) => {
        if (!bar) return;
        const weight = WEIGHTS[index] ?? 0.5;
        const jitter = 0.72 + Math.random() * 0.28;
        const size = Math.max(0.16, Math.min(1, now * weight * jitter * 1.5));
        bar.style.transform = `scaleY(${size})`;
      });
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  return (
    <div
      aria-hidden
      className={cn("flex items-center justify-center gap-[3px]", className)}
      style={{ height }}
    >
      {Array.from({ length: BARS }, (_, index) => (
        <span
          key={index}
          ref={(node) => {
            bars.current[index] = node;
          }}
          className="w-[3px] rounded-full bg-primary transition-transform duration-75"
          style={{ height: "100%", transformOrigin: "center" }}
        />
      ))}
    </div>
  );
}
