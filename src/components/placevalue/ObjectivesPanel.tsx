import { RewardKind, REWARD_META } from "@/lib/placeValueRewards";

export interface PVObjective {
  kind: RewardKind;
  collected: number;
  target: number;
}

export const ObjectivesPanel = ({ objectives }: { objectives: PVObjective[] }) => (
  <div className="rounded-lg border border-primary/30 bg-card/70 p-2 backdrop-blur">
    <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">Goals</h3>
    <ul className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
      {objectives.map((o) => {
        const m = REWARD_META[o.kind];
        const pct = Math.min(100, (o.collected / o.target) * 100);
        const done = o.collected >= o.target;
        return (
          <li key={o.kind} className="flex items-center gap-1.5">
            <img src={m.src} alt="" className="h-5 w-5 object-contain shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between text-[10px]">
                <span className={done ? "font-bold text-emerald-400" : "font-semibold truncate"}>{m.label}</span>
                <span className="tabular-nums text-muted-foreground">{Math.min(o.collected, o.target)}/{o.target}</span>
              </div>
              <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div className={done ? "h-full bg-emerald-400 transition-all" : "h-full bg-primary transition-all"} style={{ width: `${pct}%` }} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  </div>
);
