import { BIDMAS_REWARD_META, BidmasRewardKind } from "@/lib/bidmasRewards";

interface Props {
  totals: Record<BidmasRewardKind, number>;
  goals: Partial<Record<BidmasRewardKind, number>>;
}

export const ObjectivesPanel = ({ totals, goals }: Props) => (
  <div className="rounded-2xl border-2 border-primary/30 bg-card/60 p-3 backdrop-blur">
    <div className="text-center text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold mb-2">Objectives</div>
    <ul className="space-y-1.5 text-xs">
      {(Object.entries(goals) as [BidmasRewardKind, number][]).map(([k, goal]) => {
        const meta = BIDMAS_REWARD_META[k];
        const got = totals[k] || 0;
        const done = got >= goal;
        return (
          <li key={k} className="flex items-center gap-2">
            <img src={meta.src} alt="" className="h-6 w-6 object-contain" />
            <div className="flex-1">
              <div className={`text-[11px] font-bold ${meta.tint}`}>{meta.label}</div>
              <div className={`text-[10px] tabular-nums ${done ? "text-emerald-400" : "text-muted-foreground"}`}>{Math.min(got, goal)} / {goal}</div>
            </div>
          </li>
        );
      })}
    </ul>
  </div>
);
