import { TreasureKind } from "./TreasureBurst";

export interface AbacusObjective {
  kind: TreasureKind;
  collected: number;
  target: number;
}

const META: Record<TreasureKind, { src: string; label: string }> = {
  coin: { src: "/assets/rewards/coin/gold_coin.png", label: "Coins" },
  diamond: { src: "/assets/rewards/diamond/diamond_big.png", label: "Diamonds" },
  gold: { src: "/assets/rewards/treasure/gold_bars.png", label: "Gold" },
  gem: { src: "/assets/rewards/treasure/pile_of_gems.png", label: "Gems" },
};

export const AbacusObjectivesPanel = ({ objectives }: { objectives: AbacusObjective[] }) => (
  <div className="rounded-lg border bg-card/60 p-3 backdrop-blur">
    <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">Objectives</h3>
    <ul className="space-y-2">
      {objectives.map((o) => {
        const m = META[o.kind];
        const pct = Math.min(100, (o.collected / o.target) * 100);
        const done = o.collected >= o.target;
        return (
          <li key={o.kind} className="flex items-center gap-2">
            <img src={m.src} alt="" className="h-7 w-7 object-contain" loading="lazy" />
            <div className="flex-1">
              <div className="flex items-baseline justify-between text-xs">
                <span className={done ? "font-bold text-emerald-400" : "font-semibold"}>{m.label}</span>
                <span className="tabular-nums text-muted-foreground">{Math.min(o.collected, o.target)}/{o.target}</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className={done ? "h-full bg-emerald-400 transition-all" : "h-full bg-primary transition-all"} style={{ width: `${pct}%` }} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  </div>
);
