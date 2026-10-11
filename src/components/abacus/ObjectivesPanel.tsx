import { TreasureKind } from "./TreasureBurst";

export interface AbacusObjective {
  kind: TreasureKind;
  collected: number;
  target: number;
}

const META: Record<TreasureKind, { src: string; label: string }> = {
  coin: { src: "/__l5e/assets-v1/26b4d3d5-f2a5-494a-a9e3-0fa684d8531e/gold_coin.png", label: "Coins" },
  diamond: { src: "/__l5e/assets-v1/07faa783-e557-42f3-84e8-b7a5d2fd8ae5/diamond_big.png", label: "Diamonds" },
  gold: { src: "/__l5e/assets-v1/75234a44-c279-478d-aa93-37599f41c512/gold_bars.png", label: "Gold" },
  gem: { src: "/__l5e/assets-v1/953b02e3-cea2-4bdd-90ea-71e36c54c321/pile_of_gems.png", label: "Gems" },
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
