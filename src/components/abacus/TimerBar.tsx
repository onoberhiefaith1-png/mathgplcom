import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  durationSec: number;
  resetKey: number | string;
  paused?: boolean;
  onExpire: () => void;
}

export const TimerBar = ({ durationSec, resetKey, paused, onExpire }: Props) => {
  const [remaining, setRemaining] = useState(durationSec);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    // Single effect handles reset + ticking so we never read stale remaining.
    expiredRef.current = false;
    setRemaining(durationSec);
    if (paused) return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const elapsed = (t - start) / 1000;
      const r = Math.max(0, durationSec - elapsed);
      setRemaining(r);
      if (r <= 0) {
        if (!expiredRef.current) {
          expiredRef.current = true;
          onExpireRef.current();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [resetKey, paused, durationSec]);

  const pct = Math.max(0, Math.min(100, (remaining / durationSec) * 100));
  const danger = pct < 25;
  const warn = pct < 55;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        <span className="font-bold">Time</span>
        <span className={cn("tabular-nums font-bold", danger ? "text-rose-400" : warn ? "text-amber-300" : "text-emerald-300")}>
          {remaining.toFixed(1)}s
        </span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted/60 border border-border shadow-inner">
        <div
          className={cn(
            "h-full transition-[width] duration-100 ease-linear",
            danger
              ? "bg-gradient-to-r from-rose-600 to-rose-400 animate-pulse shadow-[0_0_10px_hsl(0_80%_60%/0.6)]"
              : warn
              ? "bg-gradient-to-r from-amber-500 to-yellow-300 shadow-[0_0_8px_hsl(40_90%_55%/0.5)]"
              : "bg-gradient-to-r from-emerald-500 to-emerald-300 shadow-[0_0_8px_hsl(150_70%_50%/0.5)]",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};
