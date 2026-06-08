import { BOMBS, REWARDS, RewardKind } from "@/data/tallyAssets";

const ROWS: RewardKind[] = ["coin", "heart", "diamond", "star", "key", "energy", "crown", "potion", "scroll", "gem"];

export const RewardsLegend = () => (
  <aside className="rounded-lg border bg-card/60 p-3 backdrop-blur">
    <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Rewards</h3>
    <ul className="grid grid-cols-2 gap-2 md:grid-cols-1">
      {ROWS.map((k) => (
        <li key={k} className="flex items-center gap-2 text-xs">
          <img src={REWARDS[k].src} alt="" className="h-6 w-6 object-contain" loading="lazy" />
          <span className="truncate">{REWARDS[k].label}</span>
        </li>
      ))}
    </ul>
    <h3 className="mb-2 mt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Bombs</h3>
    <ul className="grid grid-cols-2 gap-2 md:grid-cols-1">
      {(["horizontal", "vertical", "diagonal", "area"] as const).map((b) => (
        <li key={b} className="flex items-center gap-2 text-xs">
          <img src={BOMBS[b].src} alt="" className="h-6 w-6 object-contain" loading="lazy" />
          <span className="truncate">{BOMBS[b].label}</span>
        </li>
      ))}
    </ul>
  </aside>
);
