import { cn } from "@/lib/utils";

const GROUP_COLORS = [
  "bg-rose-400", "bg-emerald-400", "bg-sky-400", "bg-amber-400",
  "bg-fuchsia-400", "bg-violet-400", "bg-orange-400", "bg-teal-400",
  "bg-pink-400", "bg-lime-400",
];

interface Props {
  n: number | null;
  groupSize: number | null;
}

export const VisualGroupingMini = ({ n, groupSize }: Props) => {
  // Idle/placeholder state: show ambient floating dots
  if (n === null || groupSize === null) {
    return (
      <div className="rounded-xl border-2 border-amber-400/30 bg-card/40 p-3 backdrop-blur min-h-[260px] relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 flex flex-wrap content-center justify-center gap-1.5 opacity-30">
          {Array.from({ length: 36 }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-2.5 w-2.5 rounded-full shadow-[0_0_6px_currentColor]",
                GROUP_COLORS[i % GROUP_COLORS.length],
              )}
              style={{
                animation: `pulse ${2 + (i % 5) * 0.3}s ease-in-out ${i * 0.05}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }
  const g = Math.max(1, groupSize);
  const groups = Math.floor(n / g);
  const remainder = n - groups * g;

  return (
    <div className="rounded-xl border-2 border-amber-400/40 bg-card/40 p-3 backdrop-blur animate-fade-in">
      <div className="text-center mb-2">
        <div className="text-[9px] uppercase tracking-[0.3em] text-amber-300 font-bold">Visual Grouping</div>
        <div className="text-sm font-black tabular-nums">
          <span className="text-amber-300">{n}</span>
          <span className="text-muted-foreground"> in groups of </span>
          <span className="text-amber-300">{g}</span>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5 max-h-[260px] overflow-y-auto">
        {Array.from({ length: groups }).map((_, gi) => (
          <div key={gi} className="rounded-md border border-primary/30 bg-background/40 p-1 animate-scale-in">
            <div
              className="grid gap-0.5"
              style={{ gridTemplateColumns: `repeat(${Math.min(g, 5)}, minmax(0,1fr))` }}
            >
              {Array.from({ length: g }).map((_, di) => (
                <span
                  key={di}
                  className={cn(
                    "h-2 w-2 rounded-full shadow-[0_0_6px_currentColor]",
                    GROUP_COLORS[gi % GROUP_COLORS.length],
                  )}
                />
              ))}
            </div>
          </div>
        ))}
        {remainder > 0 && (
          <div className="rounded-md border border-dashed border-rose-400/60 bg-rose-500/5 p-1 animate-scale-in">
            <div className="flex gap-0.5">
              {Array.from({ length: remainder }).map((_, di) => (
                <span key={di} className="h-2 w-2 rounded-full bg-rose-400/70" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisualGroupingMini;
