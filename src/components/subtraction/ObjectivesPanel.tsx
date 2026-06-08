import { SubRewardKind, SUB_REWARD_META } from "@/lib/subtractionRewards";

export interface SubObjective {
  kind: SubRewardKind;
  collected: number;
  target: number;
}

export const ObjectivesPanel = ({ objectives }: { objectives: SubObjective[] }) => (
  <div className="rounded-xl border-2 border-primary/30 bg-card/70 p-2.5 backdrop-blur shadow-lg">
    <h3 className="mb-2 text-[10px] font-black uppercase tracking-widest text-primary">Objectives</h3>
    <ul className="grid grid-cols-2 lg:grid-cols-1 gap-2">
      {objectives.map((o) => {
        const m = SUB_REWARD_META[o.kind];
        const pct = Math.min(100, (o.collected / o.target) * 100);
        const done = o.collected >= o.target;
        return (
          <li key={o.kind} className="flex items-center gap-2" data-sub-objective={o.kind}>
            <img
              key={`${o.kind}-${o.collected}`}
              src={m.src}
              alt=""
              className="h-6 w-6 object-contain shrink-0 drop-shadow animate-[scale-in_0.35s_ease-out]"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between text-[11px]">
                <span className={done ? "font-bold text-emerald-400" : "font-semibold truncate"}>{m.label}</span>
                <span className="tabular-nums text-muted-foreground">{Math.min(o.collected, o.target)}/{o.target}</span>
              </div>
              <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className={done ? "h-full bg-emerald-400 transition-all" : "h-full bg-gradient-to-r from-primary to-primary/60 transition-all"} style={{ width: `${pct}%` }} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  </div>
);
