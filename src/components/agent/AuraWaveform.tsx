// The moving sound wave: proof that Aura is really hearing the teacher's voice.
//
// In a live conversation the wave also says which part of the conversation we are
// in, so nobody has to read a label to know whether she is hearing them,
// thinking, talking, or simply waiting.

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

const BARS = 13;
/** Centre bars react most, so the wave swells from the middle like a voice note. */
const WEIGHTS = Array.from({ length: BARS }, (_, index) => {
  const distance = Math.abs(index - (BARS - 1) / 2) / ((BARS - 1) / 2);
  return 0.35 + 0.65 * (1 - distance * distance);
});

export type WaveMood = "level" | "listening" | "thinking" | "speaking" | "waiting" | "idle";

export default function AuraWaveform({
  level,
  className,
  height = 24,
  mood = "level",
}: {
  level: number;
  className?: string;
  height?: number;
  mood?: WaveMood;
}) {
  const bars = useRef<Array<HTMLSpanElement | null>>([]);
  const target = useRef(level);
  const shape = useRef<WaveMood>(mood);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    target.current = level;
  }, [level]);

  useEffect(() => {
    shape.current = mood;
  }, [mood]);

  // Animated outside React so the wave stays smooth while Aura works.
  useEffect(() => {
    const started = performance.now();
    const tick = (now: number) => {
      const loud = target.current;
      const kind = shape.current;
      const beat = (now - started) / 1000;
      bars.current.forEach((bar, index) => {
        if (!bar) return;
        const weight = WEIGHTS[index] ?? 0.5;
        const jitter = 0.72 + Math.random() * 0.28;
        let size: number;
        switch (kind) {
          case "thinking": {
            // One slow breath travelling along the bars.
            const wave = 0.5 + 0.5 * Math.sin(beat * 2.2 - index * 0.45);
            size = 0.2 + wave * 0.45 * weight;
            break;
          }
          case "speaking": {
            // Busy and uneven, the shape of a voice.
            const wave = 0.5 + 0.5 * Math.sin(beat * 9 - index * 0.8);
            size = Math.min(1, 0.3 + wave * 0.7 * weight * jitter);
            break;
          }
          case "waiting": {
            // Calm and attentive: alive, but saying nothing.
            size = 0.18 + 0.08 * (0.5 + 0.5 * Math.sin(beat * 1.6 - index * 0.3));
            break;
          }
          case "idle": {
            size = 0.14;
            break;
          }
          default: {
            const idle = 0.26 + Math.random() * 0.1 * weight;
            size = Math.max(idle, Math.min(1, loud * weight * jitter * 1.5));
          }
        }
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
