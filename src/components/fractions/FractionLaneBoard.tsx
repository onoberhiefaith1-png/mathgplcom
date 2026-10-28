import { ReactNode, useEffect, useRef } from "react";
import { COLS, LaneCapsule } from "@/hooks/useLaneRunner";
import { REWARDS, RewardKind } from "@/data/tallyAssets";

const ROW_HUES = [275, 200, 140, 35, 330];

// Deterministic reward layout per (row, col) — bright, glowing, like Roman board.
// 80% coins, 20% objectives (diamond/crown).
const cellReward = (r: number, c: number): RewardKind => {
  const k = (r * 7 + c * 3 + (r % 2) * 2) % 10;
  if (k < 8) return "coin";
  if (k === 8) return "diamond";
  return "crown";
};

interface Props<P> {
  rows: number;
  activeRows: number;
  capsules: LaneCapsule<P>[];
  selectedRow: number | null;
  onSelectRow: (row: number) => void;
  renderPayload: (p: P) => ReactNode;
  registerCapsule?: (id: number, el: HTMLDivElement | null) => void;
  lastMissAt: { row: number; t: number } | null;
}

export function FractionLaneBoard<P>({
  rows,
  activeRows,
  capsules,
  selectedRow,
  onSelectRow,
  renderPayload,
  registerCapsule,
  lastMissAt,
}: Props<P>) {
  const flashRef = useRef<HTMLDivElement[]>([]);
  useEffect(() => {
    if (!lastMissAt) return;
    const el = flashRef.current[lastMissAt.row];
    if (!el) return;
    el.classList.remove("animate-pulse");
    void el.offsetWidth;
    el.classList.add("animate-pulse");
    const t = setTimeout(() => el.classList.remove("animate-pulse"), 600);
    return () => clearTimeout(t);
  }, [lastMissAt]);

  // Quick lookup: which (row,col) cells are currently covered by a capsule?
  const occupied = new Set(capsules.map((n) => `${n.row}:${n.col}`));

  return (
    <div className="space-y-2 rounded-2xl border-2 border-amber-400/30 bg-card/40 p-2 backdrop-blur">
      {Array.from({ length: rows }).map((_, r) => {
        const hue = ROW_HUES[r % ROW_HUES.length];
        const inactive = r >= activeRows;
        const selected = selectedRow === r;
        return (
          <div
            key={r}
            ref={(el) => {
              if (el) flashRef.current[r] = el;
            }}
            onClick={() => !inactive && onSelectRow(r)}
            className={[
              "relative h-20 overflow-hidden rounded-xl cursor-pointer transition-all",
              inactive ? "bg-muted/10 opacity-40 cursor-not-allowed" : "bg-muted/30",
              selected ? "ring-2 ring-amber-300 shadow-[0_0_24px_hsl(45_95%_60%/0.45)]" : "",
            ].join(" ")}
            style={{
              boxShadow: !inactive
                ? `inset 0 0 30px hsl(${hue} 80% 50% / 0.18)`
                : undefined,
            }}
          >
            {/* Lane reward icons — bright, glowing, glittering. Hidden only when a capsule occupies that cell. */}
            <div
              className="absolute inset-0 grid items-center pointer-events-none"
              style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
            >
              {Array.from({ length: COLS }).map((_, c) => {
                const kind = cellReward(r, c);
                const hidden = occupied.has(`${r}:${c}`);
                const glow =
                  kind === "crown"
                    ? "drop-shadow(0 0 10px hsl(45 100% 60% / 0.95))"
                    : kind === "diamond"
                    ? "drop-shadow(0 0 10px hsl(190 100% 65% / 0.95))"
                    : "drop-shadow(0 0 8px hsl(45 100% 60% / 0.85))";
                return (
                  <div key={c} className="flex items-center justify-center">
                    <img
                      src={REWARDS[kind].src}
                      alt=""
                      className={[
                        "h-8 w-8 transition-opacity duration-150",
                        hidden ? "opacity-0" : "opacity-100 animate-tile-pop",
                      ].join(" ")}
                      style={{ filter: glow }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Lane border */}
            <div
              className="pointer-events-none absolute inset-y-0 left-0 right-0 border-y-2 rounded-xl"
              style={{ borderColor: inactive ? "transparent" : `hsl(${hue} 80% 60% / 0.55)` }}
            />

            {/* End-of-lane danger marker */}
            <div
              className="pointer-events-none absolute right-0 top-0 bottom-0 w-2"
              style={{ background: `linear-gradient(90deg, transparent, hsl(0 80% 55% / 0.6))` }}
            />

            {/* Capsules */}
            {capsules
              .filter((n) => n.row === r)
              .map((n) => {
                const leftPct = (n.col / COLS) * 100;
                const widthPct = 100 / COLS;
                return (
                  <div
                    key={n.id}
                    ref={(el) => registerCapsule?.(n.id, el)}
                    className="absolute top-1/2 flex h-16 -translate-y-1/2 items-center justify-center rounded-2xl border-2 font-black shadow-lg backdrop-blur"
                    style={{
                      left: `${leftPct}%`,
                      width: `calc(${widthPct}% + 8px)`,
                      borderColor: `hsl(${hue} 90% 65%)`,
                      background: `hsl(${hue} 70% 22% / 0.95)`,
                      color: `hsl(${hue} 100% 92%)`,
                      transition: "left 180ms cubic-bezier(0.4, 0, 0.2, 1)",
                      boxShadow: `0 0 18px hsl(${hue} 90% 60% / 0.55)`,
                    }}
                  >
                    {renderPayload(n.payload)}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}

export default FractionLaneBoard;
