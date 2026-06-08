import { useEffect, useRef, useState } from "react";
import { SubRewardKind, SUB_REWARD_META } from "@/lib/subtractionRewards";

export interface SubFlyingEvent {
  id: number;
  kind: SubRewardKind;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

interface Props {
  events: SubFlyingEvent[];
  onArrived?: (id: number, kind: SubRewardKind) => void;
}

interface Flight extends SubFlyingEvent { started: number; }

const DURATION = 850;

export const FlyingRewards = ({ events, onArrived }: Props) => {
  const [flights, setFlights] = useState<Flight[]>([]);
  const seen = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!events.length) return;
    const now = performance.now();
    const newOnes: Flight[] = [];
    for (const e of events) {
      if (seen.current.has(e.id)) continue;
      seen.current.add(e.id);
      newOnes.push({ ...e, started: now });
    }
    if (!newOnes.length) return;
    setFlights((p) => [...p, ...newOnes]);
    for (const f of newOnes) {
      setTimeout(() => {
        onArrived?.(f.id, f.kind);
        setFlights((p) => p.filter((x) => x.id !== f.id));
      }, DURATION);
    }
  }, [events, onArrived]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {flights.map((f) => {
        const meta = SUB_REWARD_META[f.kind];
        return (
          <img
            key={f.id}
            src={meta.src}
            alt=""
            className="absolute h-9 w-9 object-contain drop-shadow-[0_0_10px_hsl(45_95%_60%/0.85)]"
            style={{
              left: 0, top: 0,
              transform: `translate(${f.from.x - 18}px, ${f.from.y - 18}px)`,
              animation: `sub-fly-${f.id} ${DURATION}ms cubic-bezier(0.45,0,0.55,1) forwards`,
            }}
          />
        );
      })}
      <style>{flights.map((f) => {
        const midX = (f.from.x + f.to.x) / 2;
        const peakY = Math.min(f.from.y, f.to.y) - 60;
        return `@keyframes sub-fly-${f.id} {
          0% { transform: translate(${f.from.x - 18}px, ${f.from.y - 18}px) scale(0.6) rotate(0deg); opacity: 0; }
          12% { transform: translate(${f.from.x - 18}px, ${f.from.y - 38}px) scale(1.25) rotate(15deg); opacity: 1; }
          55% { transform: translate(${midX - 18}px, ${peakY - 18}px) scale(1.05) rotate(180deg); opacity: 1; }
          90% { transform: translate(${f.to.x - 18}px, ${f.to.y - 18}px) scale(0.7) rotate(340deg); opacity: 1; }
          100% { transform: translate(${f.to.x - 18}px, ${f.to.y - 18}px) scale(0.35) rotate(360deg); opacity: 0; }
        }`;
      }).join("\n")}</style>
    </div>
  );
};
