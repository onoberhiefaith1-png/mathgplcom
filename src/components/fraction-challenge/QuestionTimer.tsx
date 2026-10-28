// QuestionTimer — countdown for a single fraction question.
// Resets on resetSignal; pauses when paused. On timeout, calls onTimeout.

import { useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";
import { useFractionGame } from "@/contexts/FractionGameContext";

export const QuestionTimer = ({ onTimeout }: { onTimeout: () => void }) => {
  const { duration, paused, resetSignal } = useFractionGame();
  const [remaining, setRemaining] = useState<number>(duration);
  const firedRef = useRef(false);

  useEffect(() => {
    setRemaining(duration);
    firedRef.current = false;
  }, [duration, resetSignal]);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [paused]);

  useEffect(() => {
    if (remaining === 0 && !firedRef.current) {
      firedRef.current = true;
      onTimeout();
    }
  }, [remaining, onTimeout]);

  const pct = (remaining / duration) * 100;
  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const danger = remaining <= 5;

  return (
    <div className="flex items-center gap-2 rounded-full border border-amber-200/30 bg-background/40 px-3 py-1.5">
      <Timer
        className={[
          "h-4 w-4",
          danger ? "text-rose-400 animate-pulse" : "text-amber-300",
        ].join(" ")}
      />
      <div className="flex flex-col gap-0.5 min-w-[70px]">
        <span
          className={[
            "text-xs font-bold tabular-nums",
            danger ? "text-rose-300" : "text-foreground",
          ].join(" ")}
        >
          {mm}:{String(ss).padStart(2, "0")}
        </span>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted/40">
          <div
            className={[
              "h-full transition-all",
              danger ? "bg-rose-400" : "bg-amber-300",
            ].join(" ")}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default QuestionTimer;
