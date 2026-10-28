import { Heart } from "lucide-react";
import { forwardRef, useEffect, useRef, useState } from "react";

interface Props {
  level: number;
  score: number;
  misses: number;
  missLimit: number;
  coins: number;
  speedLabel: string;
}

export const Hud = forwardRef<HTMLDivElement, Props>(
  ({ level, score, misses, missLimit, coins, speedLabel }, walletRef) => {
    const lives = Math.max(0, missLimit - misses);
    const [pulse, setPulse] = useState(false);
    const [lifeFlash, setLifeFlash] = useState(false);
    const prev = useRef(coins);
    const prevMisses = useRef(misses);
    useEffect(() => {
      if (coins !== prev.current) {
        setPulse(true);
        prev.current = coins;
        const t = setTimeout(() => setPulse(false), 400);
        return () => clearTimeout(t);
      }
    }, [coins]);
    useEffect(() => {
      if (misses > prevMisses.current) {
        setLifeFlash(true);
        const t = setTimeout(() => setLifeFlash(false), 500);
        prevMisses.current = misses;
        return () => clearTimeout(t);
      }
      prevMisses.current = misses;
    }, [misses]);
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card/60 p-3 text-sm backdrop-blur">
        <Stat label="Level" value={level} />
        <Stat label="Score" value={score} />
        <Stat label="Misses" value={`${misses}/${missLimit}`} />
        <div className={`flex items-center gap-1 ${lifeFlash ? "animate-wallet-pulse" : ""}`}>
          {Array.from({ length: missLimit }).map((_, i) => (
            <Heart
              key={i}
              className={
                i < lives ? "h-5 w-5 fill-destructive text-destructive" : "h-5 w-5 text-muted-foreground/40"
              }
            />
          ))}
        </div>
        <div ref={walletRef} className={`flex flex-col items-start ${pulse ? "animate-wallet-pulse" : ""}`}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Coins</span>
          <span className="text-base font-bold text-foreground tabular-nums">{coins.toLocaleString()}</span>
        </div>
        <Stat label="Speed" value={speedLabel} />
      </div>
    );
  },
);
Hud.displayName = "Hud";

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex flex-col items-start">
    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
    <span className="text-base font-bold text-foreground">{value}</span>
  </div>
);
