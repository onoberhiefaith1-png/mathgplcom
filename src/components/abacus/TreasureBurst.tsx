import { useEffect, useRef, useState } from "react";

export type TreasureKind = "coin" | "diamond" | "gold" | "gem";

const SRC: Record<TreasureKind, string> = {
  coin: "/assets/rewards/coin/gold_coin.png",
  diamond: "/assets/rewards/diamond/diamond_big.png",
  gold: "/assets/rewards/treasure/gold_bars.png",
  gem: "/assets/rewards/treasure/pile_of_gems.png",
};

export interface TreasureBurstItem {
  id: number;
  kind: TreasureKind;
  to: { x: number; y: number };
}

interface Props {
  origin: { x: number; y: number } | null;
  items: TreasureBurstItem[];
}

interface Flight extends TreasureBurstItem {
  from: { x: number; y: number };
  started: number;
}

export const TreasureBurst = ({ origin, items }: Props) => {
  const [flights, setFlights] = useState<Flight[]>([]);
  const seen = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!origin || !items.length) return;
    const now = performance.now();
    const newOnes: Flight[] = [];
    for (const it of items) {
      if (seen.current.has(it.id)) continue;
      seen.current.add(it.id);
      // jitter origin
      const jx = (Math.random() - 0.5) * 60;
      const jy = (Math.random() - 0.5) * 40;
      newOnes.push({ ...it, from: { x: origin.x + jx, y: origin.y + jy }, started: now + Math.random() * 200 });
    }
    if (newOnes.length) setFlights((p) => [...p, ...newOnes]);
    const t = setTimeout(() => {
      const n = performance.now();
      setFlights((p) => p.filter((f) => n - f.started < 1300));
    }, 1400);
    return () => clearTimeout(t);
  }, [items, origin]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {flights.map((f) => (
        <img
          key={f.id}
          src={SRC[f.kind]}
          alt=""
          className="absolute h-10 w-10 object-contain drop-shadow-xl"
          style={{
            left: 0,
            top: 0,
            transform: `translate(${f.from.x - 20}px, ${f.from.y - 20}px)`,
            animation: `t-fly-${f.id} 1100ms cubic-bezier(0.5,0,0.7,1) forwards`,
            animationDelay: `${Math.max(0, f.started - performance.now())}ms`,
          }}
        />
      ))}
      <style>{flights
        .map(
          (f) => `@keyframes t-fly-${f.id} {
            0% { transform: translate(${f.from.x - 20}px, ${f.from.y - 20}px) scale(0.4) rotate(0deg); opacity: 0; }
            15% { transform: translate(${f.from.x - 20}px, ${f.from.y - 80}px) scale(1.2) rotate(20deg); opacity: 1; }
            70% { opacity: 1; }
            100% { transform: translate(${f.to.x - 20}px, ${f.to.y - 20}px) scale(0.5) rotate(360deg); opacity: 0; }
          }`,
        )
        .join("\n")}</style>
    </div>
  );
};
