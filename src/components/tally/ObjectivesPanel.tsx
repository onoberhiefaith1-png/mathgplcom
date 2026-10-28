import { REWARDS } from "@/data/tallyAssets";
import { Objective } from "@/hooks/useTallyGame";

export const ObjectivesPanel = ({ objectives }: { objectives: Objective[] }) => (
  <div className="rounded-lg border bg-card/60 p-3 backdrop-blur">
    <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Objectives</h3>
    <ul className="space-y-2">
      {objectives.map((o) => {
        const def = REWARDS[o.reward];
        const pct = Math.min(100, (o.collected / o.target) * 100);
        const done = o.collected >= o.target;
        return (
          <li key={o.reward} className="flex items-center gap-2">
            <img src={def.src} alt="" className="h-7 w-7 object-contain" loading="lazy" />
            <div className="flex-1">
              <div className="flex items-baseline justify-between text-xs">
                <span className={done ? "font-bold text-primary" : "font-semibold"}>{def.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {o.collected}/{o.target}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  </div>
);
