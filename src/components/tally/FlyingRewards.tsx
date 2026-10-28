import { useEffect, useState } from "react";
import { REWARDS } from "@/data/tallyAssets";
import { CollectEvent } from "@/hooks/useTallyGame";

interface Props {
  events: CollectEvent[];
  getSourceRect: (row: number, col: number) => DOMRect | null;
  getWalletRect: () => DOMRect | null;
  onArrived?: (id: number) => void;
}

interface Flight {
  id: number;
  reward: CollectEvent["reward"];
  from: { x: number; y: number };
  to: { x: number; y: number };
  started: number;
}

export const FlyingRewards = ({ events, getSourceRect, getWalletRect }: Props) => {
  const [flights, setFlights] = useState<Flight[]>([]);

  useEffect(() => {
    if (!events.length) return;
    const newOnes: Flight[] = [];
    for (const e of events) {
      if (flights.some((f) => f.id === e.id)) continue;
      const src = getSourceRect(e.row, e.col);
      const dst = getWalletRect();
      if (!src || !dst) continue;
      newOnes.push({
        id: e.id,
        reward: e.reward,
        from: { x: src.left + src.width / 2, y: src.top + src.height / 2 },
        to: { x: dst.left + dst.width / 2, y: dst.top + dst.height / 2 },
        started: performance.now(),
      });
    }
    if (newOnes.length) setFlights((prev) => [...prev, ...newOnes]);
    // Cleanup expired
    const t = setTimeout(() => {
      const now = performance.now();
      setFlights((prev) => prev.filter((f) => now - f.started < 900));
    }, 950);
    return () => clearTimeout(t);
  }, [events, flights, getSourceRect, getWalletRect]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {flights.map((f) => {
        const def = REWARDS[f.reward];
        return (
          <img
            key={f.id}
            src={def.src}
            alt=""
            className="absolute h-9 w-9 object-contain drop-shadow-lg"
            style={{
              left: 0,
              top: 0,
              transform: `translate(${f.from.x - 18}px, ${f.from.y - 18}px)`,
              animation: `fly-${f.id} 800ms cubic-bezier(0.55, 0, 0.6, 1) forwards`,
            }}
          />
        );
      })}
      <style>{flights
        .map(
          (f) => `@keyframes fly-${f.id} {
            0% { transform: translate(${f.from.x - 18}px, ${f.from.y - 18}px) scale(1); opacity: 1; }
            70% { opacity: 1; }
            100% { transform: translate(${f.to.x - 18}px, ${f.to.y - 18}px) scale(0.4); opacity: 0; }
          }`,
        )
        .join("\n")}</style>
    </div>
  );
};
