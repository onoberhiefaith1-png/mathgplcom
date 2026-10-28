import { cn } from "@/lib/utils";

interface Props {
  active: Set<"B" | "I" | "D" | "M" | "A" | "S">;
  enabled: boolean;
  onToggle: () => void;
}

const LETTERS: { l: "B" | "I" | "D" | "M" | "A" | "S"; name: string }[] = [
  { l: "B", name: "Brackets" },
  { l: "I", name: "Indices" },
  { l: "D", name: "Division" },
  { l: "M", name: "Multiplication" },
  { l: "A", name: "Addition" },
  { l: "S", name: "Subtraction" },
];

export const BidmasGlowPanel = ({ active, enabled, onToggle }: Props) => (
  <div className="rounded-2xl border-2 border-primary/30 bg-card/60 px-3 py-2 backdrop-blur">
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold">BIDMAS Glow</span>
      <button
        onClick={onToggle}
        className={cn(
          "px-2 py-0.5 rounded-md text-[10px] font-black border transition-colors",
          enabled ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" : "bg-muted text-muted-foreground border-border",
        )}
      >
        {enabled ? "ON" : "OFF"}
      </button>
    </div>
    <div className="flex gap-1">
      {LETTERS.map(({ l, name }) => {
        const on = enabled && active.has(l);
        return (
          <div
            key={l}
            title={name}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md border text-sm font-black transition-all duration-500",
              on
                ? "border-amber-400/50 bg-amber-400/10 text-amber-200 shadow-[0_0_8px_hsl(45_90%_65%/0.3)] animate-soft-pulse"
                : "border-primary/15 text-muted-foreground/60",
            )}
          >
            {l}
          </div>
        );
      })}
    </div>
  </div>
);
