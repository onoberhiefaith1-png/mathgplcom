import { cn } from "@/lib/utils";

const GROUP_COLORS = [
  { dot: "bg-sky-400", ring: "border-sky-300/60" },
  { dot: "bg-emerald-400", ring: "border-emerald-300/60" },
  { dot: "bg-amber-400", ring: "border-amber-300/60" },
  { dot: "bg-fuchsia-400", ring: "border-fuchsia-300/60" },
  { dot: "bg-rose-400", ring: "border-rose-300/60" },
  { dot: "bg-violet-400", ring: "border-violet-300/60" },
  { dot: "bg-teal-400", ring: "border-teal-300/60" },
  { dot: "bg-orange-400", ring: "border-orange-300/60" },
  { dot: "bg-pink-400", ring: "border-pink-300/60" },
  { dot: "bg-lime-400", ring: "border-lime-300/60" },
];

interface Props {
  n: number;
  divisor: number;
}

export const DotGroups = ({ n, divisor }: Props) => {
  if (divisor < 1) return null;
  const fullGroups = Math.floor(n / divisor);
  const remainder = n - fullGroups * divisor;
  const exact = remainder === 0;

  // n is capped at 30 by caller; size dots so all fit
  const dotSize = n > 20 ? "h-2 w-2" : n > 12 ? "h-2.5 w-2.5" : "h-3 w-3";
  const gap = n > 20 ? "gap-0.5" : "gap-1";

  const displayedGroups = fullGroups;

  return (
    <div className="space-y-1.5 animate-fade-in" key={`${n}-${divisor}`}>
      <div className="rounded-md bg-background/40 border border-primary/20 p-1.5 space-y-1">
        {Array.from({ length: displayedGroups }).map((_, gi) => {
          const c = GROUP_COLORS[gi % GROUP_COLORS.length];
          return (
            <div
              key={gi}
              className={cn("flex justify-center animate-scale-in", gap)}
              style={{ animationDelay: `${gi * 25}ms`, animationFillMode: "backwards" }}
            >
              {Array.from({ length: divisor }).map((_, di) => (
                <span
                  key={di}
                  className={cn("rounded-full border", dotSize, c.dot, c.ring)}
                />
              ))}
            </div>
          );
        })}
        {remainder > 0 && (
          <div
            className={cn(
              "flex justify-center pt-1 mt-1 border-t border-dashed border-muted-foreground/30",
              gap,
            )}
          >
            {Array.from({ length: remainder }).map((_, di) => (
              <span
                key={di}
                className={cn(
                  "rounded-full border border-dashed border-muted-foreground/50 bg-muted-foreground/10",
                  dotSize,
                )}
              />
            ))}
          </div>
        )}
      </div>
      <p className="text-center text-[10px] leading-snug font-bold">
        {exact ? (
          <span className="text-emerald-300">{n} ÷ {divisor} = {fullGroups} · divisible</span>
        ) : (
          <span className="text-rose-300">{n} ÷ {divisor} = {fullGroups} r {remainder} · not divisible</span>
        )}
      </p>
    </div>
  );
};
