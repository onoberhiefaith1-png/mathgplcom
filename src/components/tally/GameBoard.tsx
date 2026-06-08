import { useEffect, useRef } from "react";
import { BOMBS, EXPLOSION_SRC, REWARDS } from "@/data/tallyAssets";
import { BlastEffect, COLS, MovingNumber, ROWS, TileContent } from "@/hooks/useTallyGame";

const ROW_HUES = [0, 60, 140, 220, 300];

interface Props {
  tiles: TileContent[][];
  revealed: boolean[][];
  active: MovingNumber[];
  blasts: BlastEffect[];
  durationSec: number;
  registerTile?: (row: number, col: number, el: HTMLDivElement | null) => void;
}

export const GameBoard = ({ tiles, revealed, active, blasts, registerTile }: Props) => {
  // Track previous tile signatures to trigger pop animation on change
  const prevSig = useRef<string[][]>([]);
  if (!prevSig.current.length) {
    prevSig.current = tiles.map((row) => row.map((t) => sig(t)));
  }

  return (
    <div className="space-y-2 rounded-lg border bg-card/40 p-2 backdrop-blur">
      {Array.from({ length: ROWS }).map((_, r) => {
        const hue = ROW_HUES[r];
        return (
          <div key={r} className="relative h-16 overflow-hidden rounded-md bg-muted/40">
            <div
              className="absolute inset-0 grid"
              style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
            >
              {tiles[r].map((t, c) => {
                const visible = revealed[r][c];
                const newSig = sig(t);
                const changed = prevSig.current[r]?.[c] !== newSig;
                if (prevSig.current[r]) prevSig.current[r][c] = newSig;
                return (
                  <div
                    key={c}
                    ref={(el) => registerTile?.(r, c, el)}
                    className="relative flex items-center justify-center border-r border-background/30 last:border-r-0"
                  >
                    {visible && (
                      <img
                        key={newSig}
                        src={t.type === "bomb" ? BOMBS[t.bomb].src : REWARDS[t.reward].src}
                        alt=""
                        className={`h-9 w-9 object-contain ${changed ? "animate-tile-pop" : ""} ${t.type === "bomb" ? "animate-bomb-pulse" : ""}`}
                        loading="lazy"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div
              className="pointer-events-none absolute inset-y-0 left-0 right-0 border-y-2"
              style={{ borderColor: `hsl(${hue} 70% 60% / 0.35)` }}
            />

            {active
              .filter((n) => n.row === r)
              .map((n) => {
                const leftPct = (n.col / COLS) * 100;
                const widthPct = 100 / COLS;
                return (
                  <div
                    key={n.id}
                    className="absolute top-1/2 flex h-12 -translate-y-1/2 items-center justify-center rounded-full border-2 text-lg font-black shadow-lg"
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      borderColor: `hsl(${hue} 80% 60%)`,
                      background: `hsl(${hue} 70% 25%)`,
                      color: `hsl(${hue} 100% 90%)`,
                      transition: "left 120ms cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  >
                    <span className="flex h-12 w-12 items-center justify-center">{n.value}</span>
                  </div>
                );
              })}

            {blasts.flatMap((b) =>
              b.cells
                .filter((c) => c.row === r)
                .map((c, i) => (
                  <img
                    key={`${b.id}-${i}`}
                    src={EXPLOSION_SRC}
                    alt=""
                    className="pointer-events-none absolute top-1/2 h-16 w-16 -translate-y-1/2 animate-in fade-in zoom-in-50"
                    style={{ left: `calc(${((c.col + 0.5) / COLS) * 100}% - 32px)` }}
                  />
                )),
            )}
          </div>
        );
      })}
    </div>
  );
};

function sig(t: TileContent): string {
  return t.type === "bomb" ? `b:${t.bomb}` : `r:${t.reward}`;
}
