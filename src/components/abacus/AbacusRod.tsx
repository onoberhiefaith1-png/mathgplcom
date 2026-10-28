import { memo } from "react";
import { cn } from "@/lib/utils";
import beadSapphire from "@/assets/abacus/bead_sapphire.png";
import beadEmerald from "@/assets/abacus/bead_emerald.png";
import beadAmber from "@/assets/abacus/bead_amber.png";
import beadAmethyst from "@/assets/abacus/bead_amethyst.png";

export type BeadKind = "sapphire" | "emerald" | "amber" | "amethyst";

const BEAD_SRC: Record<BeadKind, string> = {
  sapphire: beadSapphire,
  emerald: beadEmerald,
  amber: beadAmber,
  amethyst: beadAmethyst,
};

export interface AbacusRodProps {
  label: string;
  sub: string;
  digit: number;
  bead: BeadKind;
  disabled?: boolean;
  highlight?: "none" | "correct" | "wrong";
  onSetDigit: (d: number) => void;
}

const BEADS = 9;
const SLOT = 26;

export const AbacusRod = memo(function AbacusRod({
  label,
  sub,
  digit,
  bead,
  disabled,
  highlight = "none",
  onSetDigit,
}: AbacusRodProps) {
  const inactiveCount = BEADS - digit;
  const src = BEAD_SRC[bead];

  return (
    <div className="flex flex-col items-center select-none">
      <div
        className={cn(
          "rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-50 bg-amber-800/80 border border-amber-600/60",
          highlight === "wrong" && "ring-2 ring-destructive animate-pulse",
        )}
      >
        {label}
      </div>
      <div className="text-[10px] text-amber-200/70 mt-0.5">{sub}</div>
      <div
        className={cn(
          "relative my-2 w-12 rounded-md bg-amber-950/60 border border-amber-800/60",
          highlight === "correct" && "ring-2 ring-emerald-400 shadow-[0_0_24px_hsl(var(--primary)/0.6)]",
          highlight === "wrong" && "ring-2 ring-destructive animate-[shake_0.4s_ease-in-out]",
        )}
        style={{ height: (BEADS + 2) * SLOT + 8 }}
      >
        <div className="absolute left-1/2 top-2 bottom-2 w-1 -translate-x-1/2 rounded bg-amber-700/80" />
        <div
          className="absolute left-0 right-0 h-1.5 bg-amber-700 rounded"
          style={{ top: inactiveCount * SLOT + SLOT / 2 - 1 + 4 }}
        />
        {Array.from({ length: BEADS }).map((_, i) => {
          const isActive = i >= inactiveCount;
          const slot = isActive ? i + 2 : i;
          const onClick = () => {
            if (disabled) return;
            const nd = isActive ? BEADS - i - 1 : BEADS - i;
            onSetDigit(Math.max(0, Math.min(BEADS, nd)));
          };
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onPointerDown={(e) => { e.preventDefault(); onClick(); }}
              className={cn(
                "absolute left-1/2 -translate-x-1/2 transition-all duration-300 ease-out touch-manipulation rounded-full",
                disabled && "opacity-30 cursor-not-allowed",
                !disabled && "hover:scale-110 active:scale-95 cursor-pointer drop-shadow",
              )}
              style={{ top: slot * SLOT + 4, width: 44, height: 22 }}
              aria-label={`${label} bead ${i + 1} ${isActive ? "active" : "inactive"}`}
            >
              <img src={src} alt="" className="h-full w-full object-contain pointer-events-none" />
            </button>
          );
        })}
      </div>
      <div className="text-base font-black tabular-nums text-amber-200">{digit}</div>
    </div>
  );
});
