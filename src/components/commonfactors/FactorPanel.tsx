import { cn } from "@/lib/utils";
import { Coins } from "lucide-react";

export type PanelTone = "blue" | "purple" | "amber";

const TONES: Record<PanelTone, { border: string; text: string; chip: string; slot: string; btn: string; activeBorder: string }> = {
  blue: {
    border: "border-sky-500/50",
    activeBorder: "border-sky-400 shadow-[0_0_20px_hsl(200_90%_60%/0.5)]",
    text: "text-sky-300",
    chip: "border-sky-400 bg-sky-500/15 text-sky-100",
    slot: "border-sky-500/40 bg-sky-500/5",
    btn: "border-sky-500/40 bg-sky-500/10 text-sky-100 hover:border-sky-400",
  },
  purple: {
    border: "border-fuchsia-500/50",
    activeBorder: "border-fuchsia-400 shadow-[0_0_20px_hsl(290_90%_65%/0.5)]",
    text: "text-fuchsia-300",
    chip: "border-fuchsia-400 bg-fuchsia-500/15 text-fuchsia-100",
    slot: "border-fuchsia-500/40 bg-fuchsia-500/5",
    btn: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-100 hover:border-fuchsia-400",
  },
  amber: {
    border: "border-amber-500/50",
    activeBorder: "border-amber-400 shadow-[0_0_20px_hsl(40_95%_60%/0.5)]",
    text: "text-amber-300",
    chip: "border-amber-400 bg-amber-500/15 text-amber-100",
    slot: "border-amber-500/40 bg-amber-500/5",
    btn: "border-amber-500/40 bg-amber-500/10 text-amber-100 hover:border-amber-400",
  },
};

export type SlotMark = "neutral" | "right" | "wrong";

interface Props {
  number: number;
  tone: PanelTone;
  totalFactors: number;
  found: number[];
  marks?: SlotMark[];
  active: boolean;
  selectedDivisor: number | null;
  movedToMiddle: Set<number>;
  onPickDivisor: (d: number) => void;
  onSendToMiddle: (n: number) => void;
  onClearSlot: (i: number) => void;
}

export const FactorPanel = ({
  number, tone, totalFactors, found, marks = [], active, selectedDivisor,
  movedToMiddle, onPickDivisor, onSendToMiddle, onClearSlot,
}: Props) => {
  const t = TONES[tone];
  const divisors = Array.from({ length: number }, (_, i) => i + 1);
  const slotCount = totalFactors;

  return (
    <div
      data-cf-panel={tone}
      className={cn(
        "rounded-xl border-2 bg-card/40 p-2.5 backdrop-blur transition-all flex flex-col gap-2",
        active ? t.activeBorder : t.border,
      )}
    >
      <div className={cn("text-center text-xs font-black uppercase tracking-[0.3em]", t.text)}>
        Factors of <span className="text-base">{number}</span>
        <span className="ml-2 text-[10px] text-muted-foreground">{found.length}/{slotCount}</span>
      </div>

      {/* Slots */}
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(slotCount, 4)}, minmax(0, 1fr))` }}>
        {Array.from({ length: slotCount }).map((_, i) => {
          const v = found[i];
          const m = marks[i] ?? "neutral";
          const moved = v != null && movedToMiddle.has(v);
          return (
            <button
              key={i}
              data-cf-chip={`${tone}-${i}`}
              data-cf-slot-index={i}
              onClick={() => {
                if (v == null) return;
                if (m !== "neutral") return;
                if (moved) onClearSlot(i);
                else onSendToMiddle(v);
              }}
              onContextMenu={(e) => { e.preventDefault(); if (v != null && m === "neutral") onClearSlot(i); }}
              className={cn(
                "relative h-10 rounded-md border-2 flex items-center justify-center font-black tabular-nums text-sm transition-all",
                v == null && cn("border-dashed", t.slot, "text-muted-foreground/40"),
                v != null && m === "neutral" && t.chip,
                v != null && m === "neutral" && !moved && "ring-1 ring-emerald-400/40 hover:scale-105 cursor-pointer",
                moved && "opacity-40",
                m === "right" && "border-emerald-400 bg-emerald-500/25 text-emerald-100 shadow-[0_0_14px_hsl(150_70%_50%/0.7)]",
                m === "wrong" && "border-rose-500 bg-rose-500/20 text-rose-200 animate-pulse",
              )}
              title={v != null && !moved ? "Click to send to common middle (right-click to remove)" : undefined}
            >
              {v ?? "·"}
              {v != null && m === "neutral" && !moved && (
                <Coins className="absolute -top-1 -right-1 h-3 w-3 text-amber-300 drop-shadow" />
              )}
            </button>
          );
        })}
      </div>

      {/* Divisor toolbar */}
      <div className="mt-auto pt-1.5 border-t border-primary/10">
        <div className={cn("text-[9px] uppercase tracking-[0.3em] font-bold mb-1", t.text)}>Try a divisor</div>
        <div className="flex flex-wrap gap-1">
          {divisors.map((d) => {
            const used = found.includes(d);
            const sel = active && selectedDivisor === d;
            return (
              <button
                key={d}
                onClick={() => onPickDivisor(d)}
                disabled={used}
                className={cn(
                  "h-6 min-w-[1.5rem] px-1 rounded border text-[11px] font-black tabular-nums transition-all",
                  used ? "opacity-30 line-through" : t.btn,
                  sel && "ring-2 ring-amber-300 scale-110",
                )}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
