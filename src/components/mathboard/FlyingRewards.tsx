import { useEffect, useState } from "react";
import { useMathBoard } from "@/hooks/useMathBoard";
import { RewardKind } from "@/lib/mathboard/session";

const SRC: Record<RewardKind, string> = {
  coin: "/assets/rewards/coin/gold_coin.png",
  diamond: "/assets/rewards/diamond/diamond_big.png",
  crown: "/assets/ui/icons/crown.png",
  heart: "/assets/ui/icons/heart.png",
};

const TARGET: Record<RewardKind, string> = {
  coin: "coin",
  diamond: "diamond",
  crown: "diamond",
  heart: "heart",
};

const DURATION = 950;

interface Flight {
  id: string;
  kind: RewardKind;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export const MathBoardFlyingRewards = () => {
  const { state, flyDone } = useMathBoard();
  const [flights, setFlights] = useState<Flight[]>([]);
  const seen = useState(() => new Set<string>())[0];

  useEffect(() => {
    if (!state.flying.length) return;
    const fresh: Flight[] = [];
    let delay = 0;
    for (const f of state.flying) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      const src = document.querySelector<HTMLElement>(`[data-session-id="${f.fromSessionId}"]`);
      const tgt = document.querySelector<HTMLElement>(`[data-hud-target="${TARGET[f.kind]}"]`);
      if (!src || !tgt) {
        // Target missing — just settle.
        flyDone(f.id);
        continue;
      }
      const sr = src.getBoundingClientRect();
      const tr = tgt.getBoundingClientRect();
      fresh.push({
        id: f.id,
        kind: f.kind,
        from: { x: sr.left + sr.width / 2, y: sr.top + sr.height / 2 },
        to: { x: tr.left + tr.width / 2, y: tr.top + tr.height / 2 },
      });
      const id = f.id;
      const ms = DURATION + delay;
      setTimeout(() => {
        flyDone(id);
        setFlights((p) => p.filter((x) => x.id !== id));
      }, ms);
      delay += 120;
    }
    if (fresh.length) setFlights((p) => [...p, ...fresh]);
  }, [state.flying, flyDone, seen]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[80]">
      {flights.map((f) => (
        <img
          key={f.id}
          src={SRC[f.kind]}
          alt=""
          className="absolute h-12 w-12 object-contain drop-shadow-[0_0_18px_hsl(45_95%_60%/0.95)]"
          style={{
            left: 0,
            top: 0,
            transform: `translate(${f.from.x - 24}px, ${f.from.y - 24}px)`,
            animation: `mb-fly-${cssId(f.id)} ${DURATION}ms cubic-bezier(0.5,0,0.5,1) forwards`,
          }}
        />
      ))}
      <style>{flights
        .map((f) => {
          const midX = (f.from.x + f.to.x) / 2;
          const peakY = Math.min(f.from.y, f.to.y) - 80;
          return `@keyframes mb-fly-${cssId(f.id)} {
            0% { transform: translate(${f.from.x - 24}px, ${f.from.y - 24}px) scale(0.7) rotate(0deg); opacity: 0; }
            15% { transform: translate(${f.from.x - 24}px, ${f.from.y - 44}px) scale(1.4) rotate(20deg); opacity: 1; }
            55% { transform: translate(${midX - 24}px, ${peakY - 24}px) scale(1.15) rotate(180deg); opacity: 1; }
            90% { transform: translate(${f.to.x - 24}px, ${f.to.y - 24}px) scale(0.8) rotate(340deg); opacity: 1; }
            100% { transform: translate(${f.to.x - 24}px, ${f.to.y - 24}px) scale(0.4) rotate(360deg); opacity: 0; }
          }`;
        })
        .join("\n")}</style>
    </div>
  );
};

const cssId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "_");

export default MathBoardFlyingRewards;
