import { cn } from "@/lib/utils";
import { Crown, X } from "lucide-react";
import type { SlotMark } from "./FactorPanel";

interface Props {
  commonCount: number;
  middleSlots: (number | null)[];
  middleMarks?: SlotMark[];
  pickedHcf: number | null;
  hcfMark?: SlotMark;
  chestOpen: boolean;
  selectedMiddleIdx: number | null;
  onSelectMiddleSlot: (i: number) => void;
  onSelectHcf: () => void;
  hcfSelected: boolean;
  onClearMiddleSlot: (i: number) => void;
  onClearHcf: () => void;
}

export const CommonMiddle = ({
  commonCount, middleSlots, middleMarks = [], pickedHcf, hcfMark = "neutral",
  chestOpen, selectedMiddleIdx, onSelectMiddleSlot, onSelectHcf, hcfSelected,
  onClearMiddleSlot, onClearHcf,
}: Props) => {
  return (
    <div className="rounded-xl border-2 border-emerald-500/60 bg-card/40 p-2.5 backdrop-blur flex flex-col gap-2">
      <div className="text-center text-xs font-black uppercase tracking-[0.3em] text-emerald-300">
        Common Factors
      </div>

      {/* Slots — clickable targets to receive a chip */}
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(commonCount, 4)}, minmax(0, 1fr))` }}>
        {Array.from({ length: commonCount }).map((_, i) => {
          const v = middleSlots[i];
          const m = middleMarks[i] ?? "neutral";
          const sel = selectedMiddleIdx === i;
          return (
            <button
              key={i}
              data-cf-middle-slot={i}
              onClick={() => {
                if (m !== "neutral") return;
                if (v != null) onClearMiddleSlot(i);
                else onSelectMiddleSlot(i);
              }}
              className={cn(
                "relative h-10 rounded-md border-2 flex items-center justify-center font-black tabular-nums text-sm transition-all",
                v == null && m === "neutral" && "border-dashed border-emerald-500/40 bg-emerald-500/5 text-muted-foreground/40 hover:border-emerald-400/80",
                v != null && m === "neutral" && "border-emerald-400 bg-emerald-500/20 text-emerald-100 shadow-[0_0_12px_hsl(150_70%_50%/0.5)]",
                sel && "ring-2 ring-amber-300 scale-105",
                m === "right" && "border-emerald-400 bg-emerald-500/30 text-emerald-100 shadow-[0_0_14px_hsl(150_70%_50%/0.7)]",
                m === "wrong" && "border-rose-500 bg-rose-500/25 text-rose-200 animate-pulse",
              )}
            >
              {v ?? (sel ? "…" : "·")}
              {v != null && m === "neutral" && (
                <X className="absolute top-0 right-0.5 h-2.5 w-2.5 text-muted-foreground/60" />
              )}
            </button>
          );
        })}
      </div>

      {/* Treasure chest area */}
      <div className="relative flex-1 min-h-[60px] flex items-center justify-center">
        <div
          className={cn(
            "text-4xl transition-all duration-500",
            chestOpen ? "scale-110 drop-shadow-[0_0_20px_hsl(45_95%_60%/0.9)]" : "opacity-60",
          )}
        >
          {chestOpen ? "🎁" : "📦"}
        </div>
      </div>

      {/* HCF slot */}
      <div className="rounded-lg border-2 border-yellow-500/50 bg-yellow-500/5 p-2 text-center">
        <div className="text-[9px] uppercase tracking-[0.3em] font-bold text-yellow-300 mb-1 flex items-center justify-center gap-1">
          <Crown className="h-3 w-3" /> Highest Common Factor
        </div>
        <button
          data-cf-hcf-slot
          onClick={() => {
            if (hcfMark !== "neutral") return;
            if (pickedHcf != null) onClearHcf();
            else onSelectHcf();
          }}
          className={cn(
            "mx-auto h-12 w-16 rounded-md border-2 flex items-center justify-center font-black tabular-nums text-xl transition-all",
            pickedHcf == null && hcfMark === "neutral" && "border-dashed border-yellow-500/50 bg-yellow-500/5 text-muted-foreground/40 hover:border-yellow-400/80",
            pickedHcf != null && hcfMark === "neutral" && "border-yellow-400 bg-yellow-500/20 text-yellow-200 shadow-[0_0_18px_hsl(45_95%_60%/0.7)]",
            hcfSelected && "ring-2 ring-amber-300 scale-105",
            hcfMark === "right" && "border-yellow-400 bg-yellow-500/30 text-yellow-100 shadow-[0_0_22px_hsl(45_95%_60%/0.9)]",
            hcfMark === "wrong" && "border-rose-500 bg-rose-500/25 text-rose-200 animate-pulse",
          )}
        >
          {pickedHcf ?? (hcfSelected ? "…" : "?")}
        </button>
      </div>
    </div>
  );
};
